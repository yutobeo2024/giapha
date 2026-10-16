import React from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import type { FamilyEvent } from "../../types";
import { lunarNote, solarNote } from "../../lib/eventDates";
import { leapMonthOfYear, lunarMonthLength, lunarMonthName, lunarToSolar, solarToLunar, type LunarDate } from "../../lib/lunar";

type DateFields = Pick<Partial<FamilyEvent>, "date" | "calendar" | "lunar" | "recurring">;

interface Props {
  value: DateFields;
  onChange: (patch: DateFields) => void;
  inputCls: string;
  labelCls: string;
}

// iOS Safari cho ô ngày/giờ một bề rộng tối thiểu riêng, làm ô tràn khỏi khung trên điện thoại
const pickerFix = " min-w-0 max-w-full appearance-none [&::-webkit-date-and-time-value]:text-left";

const DEFAULT_TIME = "08:00";

/** Lỗi của ngày âm lịch, null nếu hợp lệ */
export function lunarDateError(l: LunarDate | undefined): string | null {
  if (!l) return "Chưa chọn ngày âm lịch.";
  if (!Number.isInteger(l.year) || l.year < 1800 || l.year > 2200) return "Năm âm lịch phải trong khoảng 1800–2200.";
  if (lunarToSolar(l)) return null;
  const len = lunarMonthLength(l.year, l.month, l.leap);
  if (!len) return `Năm ${l.year} không có ${lunarMonthName(l.month, l.leap)}.`;
  return `${lunarMonthName(l.month, l.leap).replace(/^t/, "T")} năm ${l.year} chỉ có ${len} ngày.`;
}

/** Ô Thời gian của sự kiện: chọn Âm lịch hoặc Dương lịch, kèm dòng quy đổi sang lịch kia */
const EventDateField: React.FC<Props> = ({ value, onChange, inputCls, labelCls }) => {
  const isLunar = value.calendar === "lunar";
  const current = value.date ? new Date(value.date) : null;
  const time = current ? format(current, "HH:mm") : DEFAULT_TIME;
  const lunar = value.lunar ?? solarToLunar(current ?? new Date());

  /** Đổi ngày âm hoặc giờ: tính lại ngày dương lưu vào `date` (ngày không tồn tại thì giữ nguyên `date`) */
  const setLunar = (l: LunarDate, t = time) => {
    const solar = lunarToSolar(l);
    const [h, m] = t.split(":").map(Number);
    if (solar) solar.setHours(h || 0, m || 0);
    onChange({ lunar: l, ...(solar ? { date: solar.toISOString() } : {}) });
  };

  const switchTo = (calendar: "lunar" | "solar") => {
    if (calendar === value.calendar) return;
    if (calendar === "solar") return onChange({ calendar });
    const base = current ?? new Date(new Date().setHours(8, 0, 0, 0));
    onChange({ calendar, lunar: solarToLunar(base), date: base.toISOString() });
  };

  const leapMonth = leapMonthOfYear(lunar.year);
  const monthLen = lunarMonthLength(lunar.year, lunar.month, lunar.leap) || 30;
  const error = isLunar ? lunarDateError(lunar) : null;

  const tabCls = (active: boolean) =>
    `flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
      active ? "bg-white text-[#8B2323] shadow-sm" : "text-[#6B665F] hover:text-[#2D2A26]"
    }`;

  return (
    <div className="md:col-span-2 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <label className={labelCls + " mb-0"}>Thời gian</label>
        <div className="flex w-48 p-1 bg-[#F3F0EA] rounded-xl" role="tablist" aria-label="Loại lịch">
          <button type="button" role="tab" aria-selected={isLunar} onClick={() => switchTo("lunar")} className={tabCls(isLunar)}>
            Âm lịch
          </button>
          <button type="button" role="tab" aria-selected={!isLunar} onClick={() => switchTo("solar")} className={tabCls(!isLunar)}>
            Dương lịch
          </button>
        </div>
      </div>

      {isLunar ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <span className="block text-[11px] text-[#A19D96] mb-1">Ngày</span>
            <select
              value={lunar.day}
              onChange={(e) => setLunar({ ...lunar, day: Number(e.target.value) })}
              className={inputCls}
              aria-label="Ngày âm lịch"
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d} disabled={d > monthLen}>
                  {d <= 10 ? `Mùng ${d}` : d}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] text-[#A19D96] mb-1">Tháng</span>
            <select
              value={`${lunar.month}${lunar.leap ? "n" : ""}`}
              onChange={(e) => {
                const leap = e.target.value.endsWith("n");
                setLunar({ ...lunar, month: parseInt(e.target.value, 10), leap: leap || undefined });
              }}
              className={inputCls}
              aria-label="Tháng âm lịch"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).flatMap((m) => {
                const name = lunarMonthName(m).replace(/^t/, "T");
                const opts = [<option key={m} value={`${m}`}>{name}</option>];
                if (m === leapMonth) opts.push(<option key={`${m}n`} value={`${m}n`}>{name} nhuận</option>);
                return opts;
              })}
            </select>
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] text-[#A19D96] mb-1">Năm</span>
            <input
              type="number"
              inputMode="numeric"
              min={1800}
              max={2200}
              value={Number.isFinite(lunar.year) ? lunar.year : ""}
              onChange={(e) => {
                const year = parseInt(e.target.value, 10);
                // Đổi năm mà tháng nhuận không còn thì về tháng thường
                const leap = lunar.leap && leapMonthOfYear(year) === lunar.month ? true : undefined;
                setLunar({ ...lunar, year, leap });
              }}
              className={inputCls}
              aria-label="Năm âm lịch"
            />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] text-[#A19D96] mb-1">Giờ</span>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => e.target.value && setLunar(lunar, e.target.value)}
              className={inputCls + pickerFix}
              aria-label="Giờ"
            />
          </div>
        </div>
      ) : (
        <input
          required
          type="datetime-local"
          value={current ? format(current, "yyyy-MM-dd'T'HH:mm") : ""}
          onChange={(e) => onChange({ date: e.target.value ? new Date(e.target.value).toISOString() : "" })}
          className={inputCls + pickerFix}
        />
      )}

      <p className={`mt-2 text-sm ${error ? "text-red-600 font-medium" : "text-[#6B665F] italic"}`} aria-live="polite">
        {error
          ? error
          : current
            ? isLunar
              ? `${solarNote(current)}, ${format(current, "EEEE", { locale: vi })}`
              : lunarNote(current)
            : " "}
      </p>

      <label className="mt-3 flex items-center gap-2 text-sm text-[#2D2A26] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!value.recurring}
          onChange={(e) => onChange({ recurring: e.target.checked })}
          className="w-4 h-4 accent-[#8B2323]"
        />
        Lặp lại hằng năm {isLunar ? "theo ngày âm lịch" : "theo ngày dương lịch"}
      </label>
    </div>
  );
};

export default EventDateField;
