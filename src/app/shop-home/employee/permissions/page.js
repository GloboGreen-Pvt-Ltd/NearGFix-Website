'use client';

/**
 * /shop-home/employee/permissions — "Permission Requests", the Partner app's
 * OwnerPermissionRequests route (Dashboard → Permissions): the same leave
 * requests screen limited to leaveType PERMISSION rows, with Approve/Reject.
 * See LeaveRequestsBoard.
 */

import LeaveRequestsBoard from '@/components/shop-dashboard/LeaveRequestsBoard';

export default function PermissionsPage() {
  return <LeaveRequestsBoard kind="PERMISSION" />;
}
