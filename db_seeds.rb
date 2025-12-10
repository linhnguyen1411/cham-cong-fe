# db/seeds.rb - TimeKeep Pro Seed Data
# Run with: rails db:seed
# Updated: 15 staff, 75 days (Sep 25 - Dec 9, 2025), 1 shift/day per staff
# Distribution: 60% on-time, 20% late, 20% early checkout (deteputs "\n📈 Expected Statistics:"
puts "  - staff01 (Nguyen Van A): 100% on-time (75/75 sessions) 🌟 TEST RANKING"
puts "  - Other staff: ~60% on-time, ~20% late, ~20% early checkout"
puts "  - Every 5 days pattern: 3 on-time + 1 late + 1 early checkout"
puts "  - Top on-time should show Nguyen Van A at #1 with 100%"
puts "  - Date filters: today, month, 7 days, 30 days, all available"stic)

require 'time'

# ==================== CLEAR EXISTING DATA ====================
puts "🗑️  Clearing existing data..."
WorkSession.delete_all
WorkShift.delete_all
User.delete_all

# ==================== CREATE USERS ====================
puts "👥 Creating users..."

admin = User.create!(
  username: 'admin',
  password: '123456',
  password_confirmation: '123456',
  full_name: 'Admin User',
  role: 'admin'
)

users = {
  'staff01' => 'Nguyen Van A',
  'staff02' => 'Tran Thi B',
  'staff03' => 'Pham Van C',
  'staff04' => 'Hoang Thi D',
  'staff05' => 'Dang Van E',
  'staff06' => 'Ly Thi F',
  'staff07' => 'Ngo Van G',
  'staff08' => 'Trinh Thi H',
  'staff09' => 'Vu Van I',
  'staff10' => 'Bui Thi J',
  'staff11' => 'Cao Van K',
  'staff12' => 'Le Thi L',
  'staff13' => 'Duong Van M',
  'staff14' => 'Phan Thi N',
  'staff15' => 'Ung Van O'
}

staff_users = users.map do |username, full_name|
  User.create!(
    username: username,
    password: '123456',
    password_confirmation: '123456',
    full_name: full_name,
    role: 'staff'
  )
end

puts "✅ Created 1 admin + #{staff_users.length} staff users"

# ==================== CREATE WORK SHIFTS ====================
puts "⏰ Creating work shifts..."

morning_shift = WorkShift.create!(
  name: 'Ca sáng',
  start_time: '08:00',
  end_time: '12:00',
  late_threshold: 30
)

afternoon_shift = WorkShift.create!(
  name: 'Ca chiều',
  start_time: '13:00',
  end_time: '17:00',
  late_threshold: 30
)

evening_shift = WorkShift.create!(
  name: 'Ca tối',
  start_time: '18:00',
  end_time: '22:00',
  late_threshold: 30
)

shifts = [morning_shift, afternoon_shift, evening_shift]
puts "✅ Created #{shifts.length} work shifts"

# ==================== HELPER FUNCTIONS ====================

# Convert time string "HH:MM" to minutes from midnight
def time_to_minutes(time_str)
  parts = time_str.split(':')
  parts[0].to_i * 60 + parts[1].to_i
end

# Create work session with check-in/out times
def create_session(user, date, check_in_time, check_out_time, shift)
  start_dt = Time.zone.parse("#{date} #{check_in_time}")
  end_dt = Time.zone.parse("#{date} #{check_out_time}")
  
  duration_seconds = (end_dt - start_dt).to_i
  
  # Evaluate on-time
  check_in_minutes = time_to_minutes(check_in_time)
  shift_start_minutes = time_to_minutes(shift.start_time)
  late_threshold = shift.late_threshold
  
  minutes_late = [0, check_in_minutes - (shift_start_minutes + late_threshold)].max
  is_on_time = minutes_late == 0
  
  # Evaluate early checkout
  check_out_minutes = time_to_minutes(check_out_time)
  shift_end_minutes = time_to_minutes(shift.end_time)
  
  minutes_before_end = [0, shift_end_minutes - check_out_minutes].max
  is_early_checkout = minutes_before_end > 0
  
  session = WorkSession.create!(
    user: user,
    start_time: start_dt,
    end_time: end_dt,
    duration_minutes: (duration_seconds / 60.0).round(1),
    date_str: date,
    work_shift: shift,
    is_on_time: is_on_time,
    minutes_late: minutes_late,
    is_early_checkout: is_early_checkout,
    minutes_before_end: minutes_before_end
  )
  
  session
end

# ==================== CREATE WORK SESSIONS ====================
puts "📝 Creating work sessions (75 days, 1 shift/day per staff)..."

today = Date.current
# Last 75 days
start_date = today - 74
dates_75_days = (start_date..today).map { |d| d.strftime('%Y-%m-%d') }

session_count = 0

# Create sessions for all 15 staff users
# Each staff works 1 shift per day for 75 days
# Distribution: 60% on-time, 20% late, 20% early checkout (deterministic by day)
# SPECIAL: staff01 is always 100% on-time for testing
staff_users.each_with_index do |user, staff_idx|
  puts "  Creating sessions for: #{user.full_name}..."
  
  dates_75_days.each_with_index do |date, day_idx|
    # Each staff gets ONE shift per day (morning shift)
    shift = morning_shift
    
    # SPECIAL: staff01 (staff_idx == 0) is always on-time
    if staff_idx == 0
      # staff01: Always on-time, never late, never early checkout
      check_in_offset = [5, 10, 15].sample
      check_in_time = (Time.strptime(shift.start_time, '%H:%M') - check_in_offset.minutes).strftime('%H:%M')
      check_out_time = shift.end_time
    else
      # Other staff: Deterministic distribution based on day_idx
      # day_idx % 5: 0,1,2,3,4 -> 0,1,2,3,4 (5 days = 3 on-time + 1 late + 1 early)
      day_pattern = day_idx % 5
      
      if day_pattern < 3 # 60% on-time (days 0, 1, 2 out of every 5)
        # Check-in 5-15 minutes early
        check_in_offset = [5, 10, 15].sample
        check_in_time = (Time.strptime(shift.start_time, '%H:%M') - check_in_offset.minutes).strftime('%H:%M')
        check_out_time = shift.end_time
      elsif day_pattern == 3 # 20% late (day 3 out of every 5)
        # Check-in 35-50 minutes late (after 30-min threshold)
        minutes_late = [35, 40, 45, 50].sample
        check_in_time = (Time.strptime(shift.start_time, '%H:%M') + minutes_late.minutes).strftime('%H:%M')
        check_out_time = shift.end_time
      else # 20% early checkout (day 4 out of every 5)
        # Check-in on-time, but checkout early
        check_in_offset = [5, 10].sample
        check_in_time = (Time.strptime(shift.start_time, '%H:%M') - check_in_offset.minutes).strftime('%H:%M')
        minutes_early = [20, 30, 40].sample
        check_out_time = (Time.strptime(shift.end_time, '%H:%M') - minutes_early.minutes).strftime('%H:%M')
      end
    end
    
    create_session(user, date, check_in_time, check_out_time, shift)
    session_count += 1
  end
end

puts "✅ Created #{session_count} work sessions"

# ==================== SUMMARY ====================
puts "\n" + "="*60
puts "🎉 SEED DATA COMPLETED!"
puts "="*60

puts "\n📊 Summary:"
puts "  Users: 1 admin + #{staff_users.length} staff"
puts "  Work Shifts: 3 (Ca sáng 08:00-12:00, Ca chiều 13:00-17:00, Ca tối 18:00-22:00)"
puts "  Work Sessions: #{WorkSession.count}"
puts "  Date Range: #{start_date.strftime('%Y-%m-%d')} to #{today.strftime('%Y-%m-%d')} (75 days)"
puts "  Average sessions per staff: #{(WorkSession.count / staff_users.length).round(1)}"

puts "\n👥 Test Accounts:"
puts "  Admin: username='admin', password='123456'"
staff_users.each_with_index do |user, idx|
  puts "  Staff #{idx + 1}: username='#{user.username}' (#{user.full_name}), password='123456'"
end

puts "\n� Expected Statistics:"
puts "  - Each staff works 75 days across 3 shifts"
puts "  - ~60% on-time, ~20% late, ~20% early checkout (random distribution)"
puts "  - Top on-time staff should show ~60% rate"
puts "  - Date filters: 7 days, 30 days, 75 days all available"

puts "\n" + "="*60
