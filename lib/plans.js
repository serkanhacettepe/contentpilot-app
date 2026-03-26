// lib/plans.js
export const PLAN_LIMITS = {
  free: 3,
  starter: 20,
  pro: 30,
  business: 100,
};

export function getPlanLimit(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}
