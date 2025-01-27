import { Schema, model, models } from 'mongoose';

const LeagueSchema = new Schema({
	name: { type: String, required: true },
	sport: { type: String, required: true },
	mode: { type: String, required: true },
	password: { type: String, required: true },
	creatorId: { type: String, required: true },
	members: { type: [String], default: [] }
});

export const League = models.League || model('League', LeagueSchema);
