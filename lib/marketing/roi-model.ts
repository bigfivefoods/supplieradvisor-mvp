import { COMPANY_SUBSCRIPTION_MONTHLY_ZAR } from '@/lib/billing/company-subscription';

export type RoiInputs = {
  people: number;
  hoursPerWeek: number;
  hourlyRate: number;
  tools: number;
  toolCost: number;
};

export const DEFAULT_ROI_INPUTS: RoiInputs = {
  people: 8,
  hoursPerWeek: 6,
  hourlyRate: 350,
  tools: 5,
  toolCost: 1200,
};

export function calculateRoiModel(inputs: RoiInputs) {
  const labourMonth = inputs.people * inputs.hoursPerWeek * 4.33 * inputs.hourlyRate;
  const toolsMonth = inputs.tools * inputs.toolCost;
  const wasteMonth = labourMonth + toolsMonth;
  const saCost = COMPANY_SUBSCRIPTION_MONTHLY_ZAR;
  const reclaimed = labourMonth * 0.65;
  const toolsSaved = toolsMonth * 0.55;
  const monthlyGain = reclaimed + toolsSaved - saCost;
  const annualGain = monthlyGain * 12;
  const hoursReclaimed = inputs.people * inputs.hoursPerWeek * 4.33 * 0.65;

  return {
    labourMonth,
    toolsMonth,
    wasteMonth,
    reclaimed,
    toolsSaved,
    monthlyGain,
    annualGain,
    hoursReclaimed,
    saCost,
  };
}
