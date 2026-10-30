import { useState } from 'react';
import { validateManualReceipt } from '../engine/shipmentAdapter';
import { useShipmentSession } from '../suite/ShipmentSession';
import { useShipmentDraft } from '../suite/useShipmentDraft';
import type { ReceiptInput } from '../suite/types';

export function ReceivingTask() {
  const session = useShipmentSession();
  const [entry, setEntry] = useState<ReceiptInput>({ receiver: '', units: [] });
  const [notice, setNotice] = useState('');
  const [discrepancies, setDiscrepancies] = useState<string[]>([]);
  const draft = useShipmentDraft({ value: entry, importValue: shipment => shipment.delivery ? { receiver: shipment.delivery.receiver, units: shipment.delivery.units } : { receiver: '', units: shipment.input.units.map(unit => ({ id: unit.id, barcode: '', slotCode: '' })) }, applyValue: value => { setEntry(value); setDiscrepancies([]); } });
  if (!session?.selectedId || !session.shipment) return null;
  const shipment = session.shipment;
  const assignments = shipment.results.warehouse?.details.assignments as { unitId: string; barcode: string; slotId: string; slotCode: string }[] | undefined;
  const update = (id: string, field: 'barcode' | 'slotCode', value: string) => { setEntry(previous => ({ ...previous, units: previous.units.map(unit => unit.id === id ? { ...unit, [field]: value } : unit) })); setNotice(''); };
  return <section className="execution-task" aria-labelledby="manual-receipt-title">
    <div className="execution-task-heading"><div><span className="execution-eyebrow">RECEIVING EXECUTION · MANUAL SCENARIO ENTRY</span><h2 id="manual-receipt-title">{shipment.delivery ? 'Committed scenario receipt' : 'Receive identified handling units'}</h2></div><button onClick={() => session.inspect('shipment')}>Inspect delivery evidence</button></div>
    {shipment.delivery ? <><p>Manually confirmed by <strong>{shipment.delivery.receiver}</strong> at {new Date(shipment.delivery.receivedAt).toLocaleString()}. No physical scanner or device was connected.</p><ul>{shipment.delivery.units.map(unit => <li key={unit.id}><button onClick={() => session.inspect(`unit:${unit.id}`)}>{shipment.input.units.find(item => item.id === unit.id)?.description ?? unit.id}</button> · barcode <code>{unit.barcode}</code> · <code>{unit.slotCode}</code></li>)}</ul><a href={session.productUrl('command-center-portal')}>Review exceptions and invoice evidence</a></> : <>
      <p className="execution-task-note">Enter each handling-unit barcode and destination location, then name the receiver. Expected values remain available for review. Confirmation records a manually entered local scenario receipt, not a physical scan.</p>
      {shipment.status !== 'arrived' && <p>Receipt confirmation requires recorded arrival. Current status: <strong>{shipment.status.replaceAll('_', ' ')}</strong>. <a href={session.productUrl('product-05-fleet-telematics')}>Open movement task</a></p>}
      {draft.incoming && <p role="status">The shared record changed while you entered receipt evidence. Entries are retained. <button onClick={draft.loadCurrent}>Load current shipment</button></p>}
      {draft.error && <p role="alert">{draft.error}</p>}
      <label className="execution-field">Receiver name<input value={entry.receiver} maxLength={100} onChange={event => setEntry(previous => ({ ...previous, receiver: event.target.value }))} /></label>
      <div className="receiving-entry-list">{shipment.input.units.map((unit, index) => { const row = entry.units.find(item => item.id === unit.id); const assignment = assignments?.find(item => item.unitId === unit.id); return <fieldset key={unit.id}><legend>Handling unit {index + 1}: {unit.description}</legend><button onClick={() => session.inspect(`unit:${unit.id}`)}>Inspect handling unit {index + 1}</button><details><summary>Expected barcode and receiving location</summary><p>Original identity: <code>{unit.id}</code></p><p>Barcode: <code>{unit.barcode}</code></p><p>Accepted location: <code>{assignment?.slotCode ?? 'No current accepted location'}</code></p></details><label className="execution-field">Handling unit {index + 1} barcode<input value={row?.barcode ?? ''} autoComplete="off" onChange={event => update(unit.id, 'barcode', event.target.value)} /></label><label className="execution-field">Handling unit {index + 1} location<input value={row?.slotCode ?? ''} autoComplete="off" onChange={event => update(unit.id, 'slotCode', event.target.value)} /></label></fieldset>; })}</div>
      <div className="execution-actions"><button disabled={!draft.canSubmit || shipment.status !== 'arrived'} onClick={async () => { try { if (!draft.basis) throw new Error('Load the current shipment before confirming receipt.'); validateManualReceipt(shipment, entry); const next = await session.submit('deliver', { ...entry, source: 'manual_scenario_entry' }, draft.basis.revision); if (next) { draft.acknowledge(next, entry); setDiscrepancies([]); setNotice('Manual scenario receipt committed with the original identities, barcodes and accepted locations.'); } } catch (error) { const message = error instanceof Error ? error.message : 'Receipt could not be confirmed.'; setDiscrepancies(previous => [...previous, message]); setNotice('Receipt was not recorded. Correct the entered evidence or inspect the accepted plan.'); } }}>Confirm manual scenario receipt</button><button onClick={() => session.inspect('stage:warehouse')}>Inspect accepted receiving plan</button><a href={session.productUrl('command-center-portal')}>Report and resolve an exception</a></div>
      {discrepancies.length > 0 && <div role="alert"><strong>Entry discrepancies ({discrepancies.length})</strong><ul>{discrepancies.map((message, index) => <li key={index}>{message}</li>)}</ul><p>These local validation failures are retained in this working draft. They are not automatically classified as physical shipment damage or a shared exception.</p></div>}
    </>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
