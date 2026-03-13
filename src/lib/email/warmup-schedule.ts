export function getDailyLimit(accountAgeDays: number): number {
    // Industry standard warm-up schedule
    if (accountAgeDays <= 7) return 5    // Week 1: max 5/day
    if (accountAgeDays <= 14) return 10   // Week 2: max 10/day
    if (accountAgeDays <= 21) return 20   // Week 3: max 20/day
    if (accountAgeDays <= 30) return 30   // Week 4: max 30/day
    return 40                              // Month 2+: max 40/day
}

export function getDelayBetweenEmails(accountAgeDays: number): number {
    // Minimum minutes between each email send
    if (accountAgeDays <= 14) return 15   // 15 min gap — looks human
    if (accountAgeDays <= 30) return 8    // 8 min gap
    return 3                               // 3 min gap when warmed up
}
