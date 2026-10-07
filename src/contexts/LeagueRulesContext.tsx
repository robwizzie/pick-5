'use client';

import { createContext, useContext } from 'react';
import { rulesFor, type ScoringRules } from '@/lib/leagueRules';

// The open league's scoring rules (lock multiplier, TFS on/off). Provided by the league page;
// anywhere else falls back to the defaults.
const LeagueRulesContext = createContext<ScoringRules>(rulesFor('standard'));

export const LeagueRulesProvider = LeagueRulesContext.Provider;

export const useLeagueRules = () => useContext(LeagueRulesContext);
