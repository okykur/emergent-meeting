import { useMemo, useState } from "react";
import { X, Loader2, CalendarClock } from "lucide-react";
import { api, formatApiError } from "../api";
import { toYMD, nowTime } from "../utils/dates";

export default function BookingDialog({ room, onClose, onBooked }) {
  const today = useMemo(() => toYMD(new Date()), []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return toYMD(d);
  }, []);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [participants, setParticipants] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (startTime >= endTime) {
      setError("End time must be after start time.");
      return;
    }
    if (participants > room.capacity) {
      setError(`Participants exceed room capacity (${room.capacity}).`);
      return;
    }
    if (date === today && startTime < nowTime()) {
      setError("Cannot book a time in the past.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/bookings", {
        room_id: room.id,
        title,
        date,
        start_time: startTime,
        end_time: endTime,
        participants: Number(participants),
        notes,
      });
      onBooked?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fade-in-up"
      data-testid="booking-dialog"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-sm border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Request Booking
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">
              {room.name}
            </h3>
            <p className="text-xs text-slate-500">
              {room.location} · Capacity {room.capacity}
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="booking-dialog-close"
            className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5" data-testid="booking-form">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Meeting title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="booking-title-input"
              placeholder="Q2 Strategy Review"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                required
                min={today}
                max={maxDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="booking-date-input"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="booking-start-input"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="booking-end-input"
                className="w-full rounded-sm border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Participants (max {room.capacity})
            </label>
            <input
              type="number"
              min={1}
              max={room.capacity}
              required
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              data-testid="booking-participants-input"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="booking-notes-input"
              rows={3}
              placeholder="AV setup, catering, etc."
              className="w-full resize-none rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15"
            />
          </div>
          {error && (
            <div
              className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="booking-error"
            >
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              data-testid="booking-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              data-testid="booking-submit-btn"
              className="flex items-center gap-2 rounded-sm bg-[#0055FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0044CC] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Submit request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
