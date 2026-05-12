// Central registry of all React Query cache keys.
// Always import from here — never hardcode strings in components.

export const QK = {
  wallet:       (userId: string) => ['wallet', userId]      as const,
  conversations:(userId: string, mode: string) => ['conversations', userId, mode] as const,
  ongoingJobs:  (userId: string) => ['ongoingJobs', userId] as const,
  proposals:    (userId: string) => ['proposals', userId]   as const,
  earnings:     (userId: string) => ['earnings', userId]    as const,
  adminStats:   ()               => ['adminStats']          as const,
  adminUsers:   ()               => ['adminUsers']          as const,
  adminJobs:    ()               => ['adminJobs']           as const,
  adminTickets: ()               => ['adminTickets']        as const,
} as const;
