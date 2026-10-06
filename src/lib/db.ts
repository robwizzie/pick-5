// src/lib/db.ts
import mongoose, { type Connection, type Model } from 'mongoose';

/*
 * MongoDB connection handling for two runtimes:
 *
 * - Node.js (Vercel, `next dev`, `next start`): one cached connection per process,
 *   exactly as before.
 *
 * - Cloudflare Workers (workerd, via @opennextjs/cloudflare): a socket opened while
 *   handling one request cannot be used by another request ("Cannot perform I/O on
 *   behalf of a different request" — the 2nd request just hangs until the runtime
 *   cancels it). So on Workers every request gets its OWN mongoose connection, keyed
 *   on the request's ExecutionContext, and the exported models (wrapped with
 *   `requestScoped`) transparently resolve to that connection's copy of the model.
 *   The connection is closed when the response finishes (see cloudflare/worker.ts).
 */

interface MongooseCache {
	conn: typeof mongoose | null;
	promise: Promise<typeof mongoose> | null;
}

declare global {
	// eslint-disable-next-line no-var
	var mongoose: MongooseCache;
}

let cached: MongooseCache = global.mongoose;

if (!cached) {
	cached = global.mongoose = { conn: null, promise: null };
}

function getMongoUri(): string {
	// Read at call time (not import time) so `next build` / `opennextjs-cloudflare build`
	// don't need the database URI, and so Cloudflare runtime secrets are picked up.
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
	}
	return uri;
}

// ---------------------------------------------------------------------------
// Cloudflare Workers: per-request connections
// ---------------------------------------------------------------------------

const isWorkerd = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

/** True on Cloudflare Workers (per-request connections; no cross-request I/O). */
export const isWorkersRuntime = isWorkerd;

// Set per request by @opennextjs/cloudflare (an AsyncLocalStorage-backed getter), so it
// is safe under concurrent requests in one isolate. Undefined outside Workers.
const CF_CONTEXT = Symbol.for('__cloudflare-context__');
// Shared with cloudflare/worker.ts, which lives in a different bundle.
const REQUEST_DB_REGISTRY = Symbol.for('pick5.requestDb');

type RequestKey = object;

const requestConnections = new WeakMap<RequestKey, Connection>();

function currentRequestKey(): RequestKey | undefined {
	if (!isWorkerd) return undefined;
	const context = (globalThis as Record<symbol, { ctx?: object } | undefined>)[CF_CONTEXT];
	return context?.ctx;
}

/** The current request's connection on Workers (created on first use), else undefined. */
function requestConnection(): Connection | undefined {
	const key = currentRequestKey();
	if (!key) return undefined;
	let conn = requestConnections.get(key);
	if (!conn) {
		conn = mongoose.createConnection(getMongoUri(), {
			// Workers allow only 6 simultaneous open connections per request (sockets AND
			// fetches). The driver keeps one monitoring socket per replica-set member
			// (3 on Atlas); 'poll' mode avoids a second, streaming RTT socket per member,
			// and a 2-socket pool leaves headroom for outbound fetches (ESPN, Resend).
			serverMonitoringMode: 'poll',
			maxPoolSize: 2,
			serverSelectionTimeoutMS: 10000
		});
		requestConnections.set(key, conn);
	}
	return conn;
}

async function closeRequestDb(key: RequestKey): Promise<void> {
	const conn = requestConnections.get(key);
	if (!conn) return;
	requestConnections.delete(key);
	try {
		// destroy() also removes it from mongoose.connections (close() would leak it).
		await conn.destroy();
	} catch (e) {
		console.error('[db] Failed to close request connection:', e);
	}
}

if (isWorkerd) {
	(globalThis as Record<symbol, unknown>)[REQUEST_DB_REGISTRY] = {
		has: (key: RequestKey) => requestConnections.has(key),
		close: closeRequestDb
	};
}

/**
 * Wraps a model so that on Cloudflare Workers every use resolves to the current
 * request's connection. Off Workers (Node.js) it returns the model unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requestScoped<M extends Model<any>>(base: M): M {
	if (!isWorkerd) return base;

	const resolve = (): M => {
		const conn = requestConnection();
		if (!conn) return base;
		return (conn.models[base.modelName] ??
			conn.model(base.modelName, base.schema, base.collection.collectionName)) as M;
	};

	return new Proxy(base, {
		get(_target, prop) {
			const model = resolve();
			const value = Reflect.get(model, prop, model);
			return typeof value === 'function' && prop !== 'prototype' && prop !== 'constructor' ? value.bind(model) : value;
		},
		set(_target, prop, value) {
			return Reflect.set(resolve(), prop, value);
		},
		has(_target, prop) {
			return Reflect.has(resolve(), prop);
		},
		construct(_target, args) {
			return Reflect.construct(resolve(), args);
		},
		apply(_target, thisArg, args) {
			return Reflect.apply(resolve(), thisArg, args);
		}
	});
}

// ---------------------------------------------------------------------------

export async function connectDB() {
	const conn = requestConnection();
	if (conn) {
		// Workers: wait for this request's connection so failures surface here, like before.
		await conn.asPromise();
		return mongoose;
	}

	if (cached.conn) {
		return cached.conn;
	}

	if (!cached.promise) {
		const opts = {
			bufferCommands: false
		};
		cached.promise = mongoose.connect(getMongoUri(), opts).then(mongoose => {
			return mongoose;
		});
	}

	try {
		cached.conn = await cached.promise;
	} catch (e) {
		cached.promise = null;
		throw e;
	}

	return cached.conn;
}
