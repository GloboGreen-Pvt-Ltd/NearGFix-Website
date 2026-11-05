'use client';

/**
 * /shop-home/employee/leave — "Leave Requests", the Partner app's
 * OwnerLeaveRequestsScreen (Dashboard → Leave). See LeaveRequestsBoard.
 */

import LeaveRequestsBoard from '@/components/shop-dashboard/LeaveRequestsBoard';

export default function LeaveRequestsPage() {
  return <LeaveRequestsBoard kind="LEAVE" />;
}
