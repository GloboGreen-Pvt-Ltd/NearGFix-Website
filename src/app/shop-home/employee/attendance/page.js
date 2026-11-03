'use client';

/**
 * /shop-home/employee/attendance — "Attendance", the Partner app's
 * OwnerStaffReportScreen in attendance mode (Dashboard → Attendance): a month
 * switcher, the month's total present days, and one row per employee with
 * Present / Late / Permission / Leave. A row opens the employee's Attendance
 * page (calendar + daily records).
 *
 * Same data as the app: GET {TICKET_BASE}/technicians for the roster, then
 * GET /technicians/{id}/attendance?month&year per employee
 * (presentDays, lateHours, permissionCount, leaveDays).
 */

import { CalendarCheck } from 'lucide-react';

import EmployeeMonthList from '@/components/shop-dashboard/EmployeeMonthList';
import { fetchTechnicianAttendance } from '@/lib/shopDashboard';

const lateValue = (s) => String(s.lateHours ?? 0).replace(/\s*hrs?$/i, '') || '0';

const COLUMNS = [
  { key: 'present', label: 'Present', value: (s) => Number(s.presentDays) || 0, accent: true },
  { key: 'late', label: 'Late', value: lateValue },
  { key: 'perm', label: 'Perm', value: (s) => Number(s.permissionCount) || 0 },
  { key: 'leave', label: 'Leave', value: (s) => Number(s.leaveDays) || 0 },
];

export default function AttendancePage() {
  return (
    <EmployeeMonthList
      title="Attendance"
      icon={CalendarCheck}
      totalLabel="Present"
      columns={COLUMNS}
      loadStats={(t, month, year) => fetchTechnicianAttendance(t.id, month, year)}
      totalOf={(s) => s.presentDays}
      hrefFor={(t) => `/shop-home/employee/attendance/view/?id=${encodeURIComponent(t.id)}`}
    />
  );
}
