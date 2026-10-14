import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check, ChevronDown, Loader2, Search, Undo2 } from "lucide-react";
import { api } from "../api";

const normalize = (value = "") => value.trim().toLocaleLowerCase("id-ID");

export function filterPositionOptions(options, query) {
  const keyword = normalize(query);
  if (!keyword) return options;
  const prefix = keyword.slice(0, 5);
  const score = (option) => {
    const name = normalize(option.position_name);
    const code = normalize(option.code_position);
    if (name.startsWith(keyword)) return 0;
    if (code.startsWith(keyword)) return 1;
    if (name.startsWith(prefix)) return 2;
    if (keyword.length > 5 && (name.includes(keyword) || code.includes(keyword))) return 3;
    return 99;
  };
  return options
    .map((option) => ({ option, score: score(option) }))
    .filter((item) => item.score < 99)
    .sort((left, right) => left.score - right.score || left.option.position_name.localeCompare(right.option.position_name, "id"))
    .map((item) => item.option);
}

export default function PositionSelect({
  id,
  value,
  isOther = false,
  onChange,
  className = "",
  testId,
  required = false,
}) {
  const [options, setOptions] = useState([]);
  const [query, setQuery] = useState(value || "");
  const [otherMode, setOtherMode] = useState(isOther);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/positions/options")
      .then(({ data }) => { if (active) setOptions(data); })
      .catch(() => { if (active) setLoadError("Daftar jabatan tidak dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (value || !query) setQuery(value || "");
  }, [value, query]);

  useEffect(() => {
    setOtherMode(isOther);
  }, [isOther]);

  const filtered = useMemo(() => filterPositionOptions(options, query), [options, query]);

  const select = (option) => {
    setOtherMode(false);
    setQuery(option.position_name);
    onChange(option.position_name, false);
    setOpen(false);
  };

  const selectOther = () => {
    const customValue = query.trim();
    setOtherMode(true);
    setQuery(customValue);
    onChange(customValue, true);
    setOpen(false);
  };

  const useMaster = () => {
    setOtherMode(false);
    setQuery("");
    onChange("", false);
    setOpen(true);
  };

  const finishTyping = () => {
    if (otherMode) return;
    const keyword = normalize(query);
    const exact = options.find((option) =>
      [option.position_name, option.code_position].some((item) => normalize(item) === keyword));
    if (exact) select(exact);
    window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A958E]" />
        <input
          id={id}
          required={required}
          maxLength={120}
          autoComplete="off"
          value={query}
          onFocus={() => { if (!otherMode) setOpen(true); }}
          onBlur={finishTyping}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            if (otherMode) onChange(nextValue, true);
            else {
              if (value) onChange("", false);
              setOpen(true);
            }
          }}
          placeholder={otherMode ? "Masukkan nama jabatan lainnya" : loading ? "Memuat jabatan..." : "Cari 1-5 huruf awal jabatan"}
          className={`${className} pl-9 pr-9`}
          style={{ paddingLeft: "2.25rem", paddingRight: "2.25rem" }}
          data-testid={testId}
          aria-autocomplete={otherMode ? "none" : "list"}
          aria-expanded={!otherMode && open}
        />
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A958E]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {otherMode && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#6E7871]">
          <span>Others: nama jabatan akan disimpan sesuai input.</span>
          <button type="button" onClick={useMaster} className="inline-flex flex-none items-center gap-1 font-bold text-[#238B57] hover:text-[#176E43]" data-testid={`${testId}-use-master`}>
            <Undo2 className="h-3 w-3" /> Pilih master
          </button>
        </div>
      )}

      {!otherMode && open && !loading && (
        <div className="absolute z-[80] mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[#D8DFDA] bg-white p-1.5 shadow-xl" role="listbox">
          {filtered.map((option) => {
            const selected = option.position_name === value;
            return (
              <button
                key={option.code_position}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[#EFF7F2] ${selected ? "bg-[#EFF7F2]" : ""}`}
                role="option"
                aria-selected={selected}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#E5F2EA] text-[#238B57]"><BriefcaseBusiness className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#26312B]">{option.position_name}</strong><small className="block text-[10px] text-[#7A857E]">{option.code_position}</small></span>
                {selected && <Check className="h-4 w-4 flex-none text-[#238B57]" />}
              </button>
            );
          })}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={selectOther}
            className="mt-1 flex w-full items-center gap-3 border-t border-[#E5EAE7] px-3 py-3 text-left text-sm font-bold text-[#526058] hover:bg-[#FFF8E7]"
            data-testid={`${testId}-other-option`}
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#FFF0C7] text-[#B66A00]">+</span>
            <span>{query.trim() ? `Others: gunakan "${query.trim()}"` : "Others / Jabatan lainnya"}</span>
          </button>
        </div>
      )}
      {loadError && <p className="mt-1 text-xs text-red-600">{loadError}</p>}
    </div>
  );
}
