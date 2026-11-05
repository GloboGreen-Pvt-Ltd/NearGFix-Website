'use client';

/**
 * /shop-home/services/invoice/generate/?ticketId=… — Invoice Generator, the
 * Partner app's InvoiceGeneratorScreen on the web. Same inputs and formulas
 * (src/lib/invoice.js):
 *   (A) Service Charges · Spare Part Taxable Value table (from the booking's
 *   price items, every cell editable) · Repair Totals + Discount · Tax mode
 *   and GST % · Charges Summary (CGST/SGST per row) · Payable Summary ·
 *   Payment & Credit (advance from the booking, amount paid now, credit).
 *
 * Generate Invoice: POST /tickets/{id}/invoice, then records "Invoice
 * Generated" on the Service History, then opens the Deliver Invoice report.
 * A first invoice waits for Ready for Delivery / Return Delivery, as in the app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from '@/lib/portalNavigation';
import { AlertTriangle, ArrowLeft, BookText, CheckCircle2, FileText, IndianRupee, Loader2, Package, Percent, ReceiptText, Wallet } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { fetchTicket } from '@/lib/shopDashboard';
import {
  GST_OPTIONS,
  TAX_MODES,
  computeChargesSummary,
  computePayment,
  computeTotals,
  fetchEvents,
  fetchInvoice,
  fmt,
  invoiceBlockedBy,
  isValidPhone,
  numberToIndianWords,
  priceItemsFromTicket,
  recordProgress,
  saveInvoice,
  toApiDate,
} from '@/lib/invoice';
import { notifyError, notifySuccess } from '@/lib/toast';

const GREEN = '#035C6C';
const GREEN_DARK = '#035C6C';
const AMBER = '#B45309';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const CARD = 'rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-[0_4px_14px_rgba(16,24,40,0.05)]';
const decimal = (v) => v.replace(/[^0-9.]/g, '');

function SectionHeader({ icon: Icon, label, right }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: GREEN_DARK }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5F3F5]">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        {label}
      </p>
      {right}
    </div>
  );
}

function Row({ label, value, strong, divider }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 py-2', divider && 'border-y border-[#EFF5EE]')}>
      <span className={cx('text-[13px]', strong ? 'font-extrabold text-[#111111]' : 'font-semibold text-[#475467]')}>{label}</span>
      <span className="shrink-0 text-[13.5px] font-extrabold text-[#111111]">{value}</span>
    </div>
  );
}

function MoneyBox({ value, onChange, readOnly, className }) {
  return (
    <label className={cx('flex min-w-[120px] shrink-0 items-center gap-1 rounded-lg sm:min-w-[140px] border border-[#E2E8E2] px-3 py-1.5', readOnly ? 'bg-[#F4F7F4]' : 'bg-white focus-within:border-[#035C6C]', className)}>
      <span className="text-[13px] font-extrabold text-[#475467]">₹</span>
      <input
        value={value}
        readOnly={readOnly}
        onChange={readOnly ? undefined : (e) => onChange(decimal(e.target.value))}
        inputMode="decimal"
        placeholder="0"
        className="w-full bg-transparent text-right text-[13.5px] font-bold text-[#111111] outline-none"
      />
    </label>
  );
}

export default function InvoiceGeneratorPage() {
  const ticketId = useSearchParams().get('ticketId');
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [existing, setExisting] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [serviceChargesStr, setServiceChargesStr] = useState('0');
  const [discountStr, setDiscountStr] = useState('0');
  const [taxMode, setTaxMode] = useState('WITHOUT');
  const [gstPercent, setGstPercent] = useState(0);
  const [spareLines, setSpareLines] = useState([]);
  const [paidNowStr, setPaidNowStr] = useState('0');
  const [paymentNote, setPaymentNote] = useState('');

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError('');
    try {
      const [t, inv, ev] = await Promise.all([fetchTicket(ticketId), fetchInvoice(ticketId).catch(() => null), fetchEvents(ticketId).catch(() => [])]);
      setTicket(t || {});
      setExisting(inv || null);
      setEvents(ev);
      // Spare lines always come from the booking's current items.
      setSpareLines(
        priceItemsFromTicket(t).map((it, i) => {
          const rate = Number(it.amount || 0);
          return { id: it.id || `spare-${i}`, description: it.label || it.serviceName || `Item ${i + 1}`, rate, warranty: it.warranty || '', qty: 1, taxableValue: rate };
        }),
      );
      setServiceChargesStr('0');
      if (inv) {
        setDiscountStr(String(Number(inv.discount || 0)));
        const mode = inv.taxMode || 'WITHOUT';
        setTaxMode(mode);
        setGstPercent(mode === 'WITHOUT' ? 0 : Number(inv.gstPercent || 0));
      }
      setPaidNowStr(String(Number(inv?.amountPaid || 0)));
      setPaymentNote(inv?.paymentNote || '');
    } catch (err) {
      setError(err.message || 'Could not load this booking.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateSpare = (i, field, value) => setSpareLines((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  const totals = useMemo(
    () => computeTotals({ serviceCharges: serviceChargesStr, discount: discountStr, spareLines, gstPercent, taxMode }),
    [serviceChargesStr, discountStr, spareLines, gstPercent, taxMode],
  );
  const chargesSummary = useMemo(
    () => computeChargesSummary({ taxMode, gstPercent, serviceCharges: totals.serviceCharges, spareLines }),
    [taxMode, gstPercent, totals.serviceCharges, spareLines],
  );
  const showChargesSummary = taxMode !== 'WITHOUT' && Number(gstPercent) > 0 && chargesSummary.length > 0;
  const advancePaid = Number(ticket?.paymentAmount || 0);
  const pay = useMemo(() => computePayment(totals.finalPayable, advancePaid, paidNowStr), [totals.finalPayable, advancePaid, paidNowStr]);
  const creditTrackable = isValidPhone(ticket?.customerPhone);
  const blockedBy = existing ? null : invoiceBlockedBy(events);

  async function onGenerate() {
    if (blockedBy) {
      notifyError(`Record "${blockedBy}" before generating the invoice.`);
      return;
    }
    setSubmitting(true);
    try {
      const byLabel = Object.fromEntries(chargesSummary.map((r) => [r.label, r]));
      const sbd = byLabel.A;
      const serviceLines =
        totals.serviceCharges > 0
          ? [
              {
                slNo: 'A',
                description: 'Service Charges',
                rate: totals.serviceCharges,
                taxableValue: sbd ? sbd.base : taxMode === 'INCLUSIVE' && gstPercent > 0 ? +(totals.serviceCharges / (1 + gstPercent / 100)).toFixed(2) : totals.serviceCharges,
                cgst: sbd?.cgst ?? 0,
                sgst: sbd?.sgst ?? 0,
                roundedValue: sbd?.rounded ?? 0,
                totalGst: sbd?.totalGst ?? 0,
                totalAmount: sbd?.total ?? totals.serviceCharges,
              },
            ]
          : [];
      const body = {
        ticketDate: ticket?.createdAt || null,
        deliveryDate: ticket?.deliveredAt || null,
        gstNo: ticket?.shopGstNo || null,
        serviceCharges: totals.serviceCharges,
        totalRepairAmount: totals.totalRepairAmount,
        spareUtilityCharge: totals.spareUtility,
        discount: totals.discount,
        taxMode,
        gstPercent,
        amount2Plus3: totals.amount2plus3,
        baseAmount: +totals.baseAmount.toFixed(2),
        totalGst: +totals.totalGst.toFixed(2),
        finalPayableAmount: +totals.finalPayable.toFixed(2),
        amountInWords: `Rupees ${numberToIndianWords(totals.finalPayable)} Only`,
        advancePaid: +pay.advance.toFixed(2),
        netPayableAmount: +pay.netPayable.toFixed(2),
        amountPaid: +pay.paidNow.toFixed(2),
        creditAmount: +pay.credit.toFixed(2),
        paymentNote: paymentNote.trim(),
        paymentDate: toApiDate(new Date()),
        spareLinesJson: JSON.stringify(
          spareLines.map((sp, i) => {
            const slNo = String.fromCharCode(66 + i);
            const bd = byLabel[slNo];
            return {
              slNo,
              description: sp.description,
              rate: Number(sp.rate) || 0,
              warranty: sp.warranty || '',
              qty: Number(sp.qty) || 1,
              taxableValue: Number(sp.taxableValue) || 0,
              cgst: bd?.cgst ?? 0,
              sgst: bd?.sgst ?? 0,
              roundedValue: bd?.rounded ?? 0,
              totalGst: bd?.totalGst ?? 0,
              totalAmount: bd?.total ?? (Number(sp.taxableValue) || 0) * (Number(sp.qty) || 1),
            };
          }),
        ),
        serviceLinesJson: JSON.stringify(serviceLines),
      };
      const resp = await saveInvoice(ticketId, body);
      try {
        await recordProgress(ticketId, 'INVOICE_GENERATED', { note: `Invoice #${resp.invoiceNo || ticket?.trackingId || ticketId} generated`, actor: 'SHOP' });
      } catch {
        /* the invoice is saved; the timeline row is non-critical */
      }
      const credit = resp.creditAmount == null ? pay.credit : Number(resp.creditAmount);
      const posted = credit > 0 && !!resp.creditLedgerEntryId;
      if (credit <= 0) notifySuccess(`Invoice #${resp.invoiceNo || ''} saved. Fully paid.`);
      else if (posted) notifySuccess(`Invoice #${resp.invoiceNo} saved. ₹${fmt(credit)} credit added to ${ticket?.customerName || 'the customer'}'s Cash Book account.`);
      else
        notifyError(
          creditTrackable
            ? `Invoice #${resp.invoiceNo} saved with ₹${fmt(credit)} credit, but the server did NOT record it in the Cash Book. Add it to the customer's account by hand.`
            : `Invoice #${resp.invoiceNo} saved with ₹${fmt(credit)} credit, but it could NOT be added to the Cash Book — this booking has no valid mobile number.`,
        );
      router.replace(`/shop-home/services/invoice/report/?ticketId=${encodeURIComponent(ticketId)}`);
    } catch (err) {
      notifyError(err, 'Could not generate the invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 pb-32">
      <div className="flex items-center gap-3 border-b border-[#ECECEC] pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-[#111111] transition hover:bg-[#ECECEC]', FOCUS_RING)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[19px] font-extrabold text-[#111111]">Invoice Generator</h1>
        {ticket?.trackingId ? <span className="max-w-[40%] shrink-0 truncate rounded-full bg-[#F3F3F3] px-3 py-1 text-[12px] font-extrabold text-[#111111]">#{ticket.trackingId}</span> : null}
      </div>

      {!ticketId ? (
        <p className="text-[14px] text-[#667085]">Open the generator from a booking.</p>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#F3F3F3]" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B42318]">{error}</p>
      ) : (
        <>
          {existing ? (
            <p className="rounded-xl border border-[#C7E6EA] bg-[#E5F3F5] px-4 py-2.5 text-[13px] font-semibold text-[#035C6C]">
              Invoice #{existing.invoiceNo} already exists — generating again replaces it.
            </p>
          ) : null}

          {/* (A) Service charges */}
          <section className={CARD}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-bold text-[#111111]">(A) Service Charges</p>
              <MoneyBox value={serviceChargesStr} onChange={setServiceChargesStr} />
            </div>
          </section>

          {/* Spare parts */}
          <section className={CARD}>
            <SectionHeader
              icon={Package}
              label="Spare Part Taxable Value"
              right={spareLines.length ? <span className="text-[11px] font-bold text-[#98A2B3]">{spareLines.length} {spareLines.length === 1 ? 'ITEM' : 'ITEMS'}</span> : null}
            />
            {spareLines.length === 0 ? (
              <p className="py-2 text-[13px] text-[#667085]">No spare parts recorded on this booking.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#E2E8E2]">
                <table className="w-full min-w-[640px] text-[12.5px]">
                  <thead className="bg-[#F7FAF7] text-left text-[11px] font-extrabold text-[#475467]">
                    <tr>
                      {['Sl.No', 'Description', 'Rate', 'Warranty', 'Qty', 'Taxable Value'].map((h) => (
                        <th key={h} className="border-b border-[#E2E8E2] px-2.5 py-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spareLines.map((sp, i) => (
                      <tr key={sp.id} className="border-t border-[#E2E8E2]">
                        <td className="w-12 px-2.5 py-1.5 text-center font-extrabold text-[#475467]">{String.fromCharCode(66 + i)}</td>
                        <td className="px-1.5 py-1">
                          <input value={sp.description} onChange={(e) => updateSpare(i, 'description', e.target.value)} className="w-full rounded px-1.5 py-1 font-semibold outline-none focus:bg-[#E5F3F5]" />
                        </td>
                        <td className="w-28 px-1.5 py-1">
                          <input value={sp.rate} onChange={(e) => updateSpare(i, 'rate', decimal(e.target.value))} inputMode="decimal" className="w-full rounded px-1.5 py-1 font-semibold outline-none focus:bg-[#E5F3F5]" />
                        </td>
                        <td className="w-28 px-1.5 py-1">
                          <input value={sp.warranty} onChange={(e) => updateSpare(i, 'warranty', e.target.value)} placeholder="—" className="w-full rounded px-1.5 py-1 font-semibold outline-none focus:bg-[#E5F3F5]" />
                        </td>
                        <td className="w-16 px-1.5 py-1">
                          <input value={sp.qty} onChange={(e) => updateSpare(i, 'qty', decimal(e.target.value))} inputMode="decimal" className="w-full rounded px-1.5 py-1 font-semibold outline-none focus:bg-[#E5F3F5]" />
                        </td>
                        <td className="w-32 px-1.5 py-1">
                          <input
                            value={sp.taxableValue}
                            onChange={(e) => updateSpare(i, 'taxableValue', decimal(e.target.value))}
                            inputMode="decimal"
                            className="w-full rounded px-1.5 py-1 font-extrabold outline-none focus:bg-[#E5F3F5]"
                            style={{ color: GREEN_DARK }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Repair totals */}
          <section className={CARD}>
            <SectionHeader icon={ReceiptText} label="Repair Totals" />
            <Row label="(1) Total Repair Amount" value={`₹${fmt(totals.totalRepairAmount)}`} />
            <Row label="(2) Service Charges" value={`₹${fmt(totals.serviceCharges)}`} />
            <Row label="(3) Spare Utility Charges (Taxable Value)" value={`₹${fmt(totals.spareUtility)}`} />
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-[13px] font-semibold text-[#475467]">(4) Discount</span>
              <MoneyBox value={discountStr} onChange={setDiscountStr} />
            </div>
          </section>

          {/* Tax & GST */}
          <section className={CARD}>
            <SectionHeader icon={Percent} label="Tax & GST" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-[12px] font-bold text-[#475467]">
                Tax
                <select
                  value={taxMode}
                  onChange={(e) => {
                    setTaxMode(e.target.value);
                    if (e.target.value === 'WITHOUT') setGstPercent(0);
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#E2E8E2] bg-white px-3 text-[13px] font-bold text-[#111111] outline-none focus:border-[#035C6C]"
                >
                  {TAX_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-bold text-[#475467]">
                GST %
                <select
                  value={taxMode === 'WITHOUT' ? '' : gstPercent}
                  disabled={taxMode === 'WITHOUT'}
                  onChange={(e) => setGstPercent(Number(e.target.value))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#E2E8E2] bg-white px-3 text-[13px] font-bold text-[#111111] outline-none focus:border-[#035C6C] disabled:bg-[#EFF5EE] disabled:text-[#8FA08F]"
                >
                  {taxMode === 'WITHOUT' ? <option value="">N/A</option> : null}
                  {GST_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}%
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-[12px] font-bold text-[#475467]">
                Amount ( 2 + 3 )
                <p className="mt-1.5 flex h-10 items-center rounded-xl border border-[#E2E8E2] bg-[#EFF5EE] px-3 text-[13px] font-extrabold text-[#111111]">{fmt(totals.amount2plus3)}</p>
              </div>
            </div>
          </section>

          {showChargesSummary ? (
            <section className={CARD}>
              <SectionHeader icon={FileText} label={`Charges Summary (CGST ${Number(gstPercent) / 2}% + SGST ${Number(gstPercent) / 2}%)`} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-right text-[12.5px]">
                  <thead className="text-[10.5px] font-extrabold text-[#98A2B3]">
                    <tr className="border-b border-[#EFF5EE]">
                      {['ITEM', 'BASE (₹)', 'CGST (₹)', 'SGST (₹)', 'ROUNDED', 'TOTAL GST', 'TOTAL (₹)'].map((h, i) => (
                        <th key={h} className={cx('px-2 py-2', i === 0 && 'text-left')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chargesSummary.map((r) => (
                      <tr key={r.label} className="border-b border-[#F7FAF7]">
                        <td className="px-2 py-1.5 text-left font-extrabold">{r.label}</td>
                        <td className="px-2 py-1.5">{fmt(r.base)}</td>
                        <td className="px-2 py-1.5">{fmt(r.cgst)}</td>
                        <td className="px-2 py-1.5">{fmt(r.sgst)}</td>
                        <td className="px-2 py-1.5">{fmt(r.rounded)}</td>
                        <td className="px-2 py-1.5">{fmt(r.totalGst)}</td>
                        <td className="px-2 py-1.5 font-extrabold" style={{ color: GREEN_DARK }}>
                          {fmt(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Payable summary */}
          <section className={CARD}>
            <SectionHeader icon={IndianRupee} label="Payable Summary" />
            <Row label="Base Amount (₹)" value={`₹${fmt(totals.baseAmount)}`} />
            <Row label="Total GST (₹)" value={`₹${fmt(totals.totalGst)}`} divider />
            <Row label="Final Payable Amount (₹)" value={`₹${fmt(totals.finalPayable)}`} strong />
          </section>

          {/* Payment & credit */}
          <section className={CARD}>
            <SectionHeader icon={Wallet} label="Payment & Credit" />
            <Row label="Final Payable Amount" value={`₹${fmt(pay.finalPayable)}`} />
            <div className="py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-[#475467]">(−) Advance Already Paid</span>
                <MoneyBox value={fmt(advancePaid)} readOnly />
              </div>
              <p className="mt-1 text-[11px] text-[#98A2B3]">{advancePaid > 0 ? `₹${fmt(advancePaid)} collected at booking` : 'Nothing was collected when this booking was taken'}</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-y border-[#EFF5EE] py-2">
              <span className="text-[13.5px] font-extrabold text-[#111111]">Net Payable Now</span>
              <span className="text-[13.5px] font-extrabold" style={{ color: GREEN_DARK }}>
                ₹{fmt(pay.netPayable)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-[13px] font-semibold text-[#475467]">(−) Amount Paid Now</span>
              <div className="flex items-center gap-2">
                {pay.netPayable > 0 && pay.paidNow < pay.netPayable ? (
                  <button
                    type="button"
                    onClick={() => setPaidNowStr(String(+pay.netPayable.toFixed(2)))}
                    className="rounded-full border border-[#C7E6EA] bg-[#E5F3F5] px-2.5 py-1 text-[11px] font-extrabold"
                    style={{ color: GREEN_DARK }}
                  >
                    Full
                  </button>
                ) : null}
                <MoneyBox value={paidNowStr} onChange={setPaidNowStr} />
              </div>
            </div>
            <div
              className="mt-2 rounded-xl border px-3.5 py-3"
              style={{ backgroundColor: pay.settled ? '#E5F3F5' : '#FEF3C7', borderColor: pay.settled ? '#C7E6EA' : '#FDE68A', color: pay.settled ? GREEN_DARK : AMBER }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-extrabold">{pay.settled ? 'Balance Payable' : 'Credit Amount (Balance Payable)'}</span>
                <span className="text-[16px] font-extrabold">₹{fmt(pay.credit)}</span>
              </div>
              <p className="mt-1 text-[11.5px]">{pay.settled ? 'Fully settled — nothing left to collect on this bill.' : 'The customer will pay this later. It becomes their outstanding balance.'}</p>
            </div>
            {!pay.settled ? (
              <>
                <div className={cx('mt-3 flex gap-2 rounded-xl border px-3 py-2.5', creditTrackable ? 'border-[#E2E8E2] bg-[#E5F3F5]' : 'border-[#FECACA] bg-[#FEE2E2]')}>
                  {creditTrackable ? <BookText className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GREEN_DARK }} aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />}
                  <div className="text-[12px]">
                    <p className="font-extrabold" style={{ color: creditTrackable ? GREEN_DARK : '#B91C1C' }}>
                      {creditTrackable ? 'Recorded in the Cash Book' : 'Cannot be recorded in the Cash Book'}
                    </p>
                    <p className={creditTrackable ? 'text-[#667085]' : 'text-[#B91C1C]'}>
                      {creditTrackable
                        ? `${ticket?.customerName || 'Customer'} · ${ticket?.customerPhone} · Invoice #${ticket?.trackingId || '—'} · ${toApiDate(new Date())}`
                        : 'This booking has no valid 10-digit mobile number, so no customer account can be opened for the credit.'}
                    </p>
                  </div>
                </div>
                <label className="mt-3 block text-[12px] font-bold text-[#475467]">
                  Payment Note
                  <textarea
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Will pay on Friday"
                    className="mt-1.5 w-full rounded-xl border border-[#E2E8E2] px-3 py-2 text-[13px] font-semibold text-[#111111] outline-none focus:border-[#035C6C]"
                  />
                </label>
              </>
            ) : null}
          </section>

          {/* Sticky CTA */}
          <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 rounded-2xl border border-[#E2E8E2] bg-[#E5F3F5]/95 p-3.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] backdrop-blur">
            {blockedBy ? (
              <p className="mb-2 text-center text-[12px] font-bold" style={{ color: AMBER }}>
                Record &quot;{blockedBy}&quot; first — Service History moves one step at a time.
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold tracking-wide text-[#667085]">{pay.settled ? 'BALANCE PAYABLE' : 'CREDIT / BALANCE'}</p>
                <p className="text-[21px] font-extrabold leading-tight" style={{ color: pay.settled ? GREEN_DARK : AMBER }}>
                  ₹{fmt(pay.credit)}
                </p>
                <p className="truncate text-[11px] font-semibold text-[#667085]">
                  Bill ₹{fmt(pay.finalPayable)}
                  {pay.advance > 0 ? ` · Advance ₹${fmt(pay.advance)}` : ''}
                  {pay.paidNow > 0 ? ` · Paid ₹${fmt(pay.paidNow)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onGenerate}
                disabled={submitting || !!blockedBy}
                className={cx('inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl px-4 text-[14px] font-extrabold text-white transition disabled:opacity-50 sm:px-6', FOCUS_RING)}
                style={{ background: `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})` }}
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                {submitting ? 'Generating…' : 'Generate Invoice'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
