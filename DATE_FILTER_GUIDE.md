# 📅 Date Filter Implementation Guide

## Overview
Dashboard date filters now apply to **ALL** displayed data:
- ✅ Summary stats (total hours, work days, on-time rate, late count, early checkout count)
- ✅ Daily hours bar chart
- ✅ Pie chart breakdown (under 8h, 8-9h, over 9h)
- ✅ Check-in time trend chart
- ✅ Top employees by hours ranking
- ✅ Top on-time employees ranking
- ✅ AdminDashboard staff filtering

---

## Date Filter Options

### 1. **Hôm nay (Today)**
- Shows only today's data
- `dateStr >= today's date`
- Example: If today is 2025-12-09, shows sessions from 2025-12-09

### 2. **Tháng này (This Month)**
- Shows from 1st day of current month to today
- `dateStr >= first day of current month`
- Example: December 1-9, 2025

### 3. **Tuần này (7 days)**
- Shows last 7 days including today
- `dateStr >= 7 days ago`
- Example: December 3-9, 2025

### 4. **30 ngày (30 days)**
- Shows last 30 days including today
- `dateStr >= 30 days ago`
- Example: November 9 - December 9, 2025

### 5. **Tất cả (All)**
- Shows all historical data from seed (Sep 25, 2025 - Dec 9, 2025)
- `dateStr >= '2000-01-01'` (very old date)

---

## How It Works

### Date Comparison Logic (Critical!)

```typescript
// Dashboard.tsx - DateFilter setup
const now = new Date();

// Helper functions for consistent date string generation
const getTodayDateStr = (): string => {
  return now.toISOString().split('T')[0]; // "2025-12-09"
};

const getDateStrNDaysAgo = (days: number): string => {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
};

// Set statsStartDateStr based on filter
if (dateFilter === 'today') {
  statsStartDateStr = getTodayDateStr();
} else if (dateFilter === 'month') {
  statsStartDateStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
} else if (dateFilter === 'week') {
  statsStartDateStr = getDateStrNDaysAgo(7);
} else if (dateFilter === 'month30') {
  statsStartDateStr = getDateStrNDaysAgo(30);
} else {
  statsStartDateStr = '2000-01-01'; // 'all'
}
```

### Session Filtering

```typescript
sessions.forEach(s => {
  if (!s.endTime) return; // Skip incomplete sessions
  
  // CRITICAL: Check date range FIRST
  if (s.dateStr < statsStartDateStr) return; // Outside date range
  
  // If we reach here, session is within date range
  // Now count it for all stats:
  totalDurationAll += s.duration;
  totalCount++;
  onTimeCount++; // etc.
  
  // Add to charts
  chartDays.set(s.dateStr, ...);
  chartDaysCheckIn.push(...);
  
  // Employee aggregation
  empMap.set(s.userId, ...);
});
```

---

## What Gets Updated with Date Filter

### Summary Stats (Top Cards)
- **Total Hours**: Sum of durations in date range
- **Total Sessions**: Count of sessions in date range
- **On-Time Rate**: (onTimeCount / totalCount) × 100%
- **Late Count**: Number of late sessions in date range
- **Early Checkout Count**: Number of early checkouts in date range

### Charts
1. **Daily Hours Bar Chart**: Hours per day in date range
2. **Pie Chart**: Work hour distribution (under 8h, 8-9h, over 9h) in date range
3. **Check-in Time Trend**: Average check-in times by day in date range

### Rankings
1. **Top Employees by Hours**: Top 5 by total hours in date range
2. **Top On-Time Employees**: Top 5 by on-time percentage in date range

### AdminDashboard
- Staff stats filter by date range
- Each staff's on-time rate, late minutes, early checkout minutes filtered by date
- Search and attendance filters work within the selected date range

---

## Data Source: db_seeds.rb

Seed data structure:
- **15 staff members** (staff01-staff15)
- **75 days** of data (Sep 25 - Dec 9, 2025)
- **1 shift per staff per day** (Ca sáng 08:00-12:00)
- **Distribution**: 60% on-time, 20% late, 20% early checkout
- **Pattern**: Every 5 days = 3 on-time + 1 late + 1 early checkout

Total sessions: 15 × 75 = **1,125 sessions**

---

## Testing the Filters

### Browser DevTools Console
When you select a date filter, check browser console (F12) for debug logs:

```
Debug - dateFilter: today
Debug - statsStartDateStr: 2025-12-09
Debug - onTimeCount: X out of Y
```

### Expected Results

**Today (Dec 9)**
- 1 day of data
- ~15 sessions (1 per staff)
- Chart: 1 day
- Stats: reflects only today

**7 Days (Dec 3-9)**
- 7 days of data
- ~105 sessions (7 × 15)
- Chart: 7 days
- Stats: aggregated over 7 days

**30 Days (Nov 9 - Dec 9)**
- 30 days of data
- ~450 sessions (30 × 15)
- Chart: 30 days
- Stats: aggregated over 30 days

**All (Sep 25 - Dec 9)**
- 75 days of data
- ~1,125 sessions (75 × 15)
- Chart: 75 days (but displayed as 7-day window)
- Stats: aggregated over all 75 days

---

## Common Issues & Fixes

### Issue: Filter shows same data regardless of selection
**Cause**: `dateStr` field missing or malformed in session data
**Fix**: Check API response has `date_str` field: `"2025-12-09"`

### Issue: Timezone mismatch between frontend & backend
**Cause**: Browser timezone ≠ Backend timezone (Bangkok UTC+7)
**Fix**: All comparisons use ISO date strings (YYYY-MM-DD) generated from `toISOString()`

### Issue: Today's filter shows no data
**Cause**: Seed data date or today's date calculation wrong
**Fix**: Check server timezone is set to Bangkok (`config.time_zone = 'Bangkok'`)

---

## Code Locations

- **Dashboard date filter logic**: `components/Dashboard.tsx` lines 65-110
- **Session filtering**: `components/Dashboard.tsx` lines 145-200
- **AdminDashboard filtering**: `components/AdminDashboard.tsx` lines 56-80
- **Seed data**: `db/seeds.rb` lines 140-185
- **API data mapper**: `services/api.ts` lines 130-160

---

## Next Steps

1. ✅ Run `rails db:seed` to generate test data
2. ✅ Refresh browser (clear cache if needed)
3. ✅ Click each date filter button and verify all data changes
4. ✅ Check browser DevTools console for debug logs
5. ✅ Verify AdminDashboard staff stats update correctly
