import { useEffect, useMemo, useState } from "react";
import { Building2, Check, ChevronDown, Loader2, Search } from "lucide-react";
import { api } from "../api";

export function companyDisplayName(name = "") {
  return name.trim().replace(/^PT\.?\s+/i, "");
}

export default function CompanySelect({ id, value, onChange, className = "", testId, required = false }) {
  const [options, setOptions] = useState([]);
  const [query, setQuery] = useState(companyDisplayName(value));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/companies/options")
      .then(({ data }) => { if (active) setOptions(data); })
      .catch(() => { if (active) setLoadError("Daftar company tidak dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setQuery(companyDisplayName(value));
  }, [value]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) => [option.search_name, option.company_name, option.company_code]
      .some((item) => String(item || "").toLowerCase().includes(keyword)));
  }, [options, query]);

  const select = (option) => {
    onChange(option.company_name);
    setQuery(option.search_name);
    setOpen(false);
  };

  const finishTyping = () => {
    const keyword = query.trim().toLowerCase();
    const exact = options.find((option) => [option.search_name, option.company_name, option.company_code]
      .some((item) => String(item || "").toLowerCase() === keyword));
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
          autoComplete="off"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={finishTyping}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setOpen(true);
          }}
          placeholder={loading ? "Memuat company..." : "Cari nama atau kode company"}
          className={`${className} pl-9 pr-9`}
          style={{ paddingLeft: "2.25rem", paddingRight: "2.25rem" }}
          data-testid={testId}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A958E]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      {open && !loading && (
        <div className="absolute z-[80] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#D8DFDA] bg-white p-1.5 shadow-xl" role="listbox">
          {filtered.map((option) => {
            const selected = option.company_name === value;
            return (
              <button
                key={option.system_number}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[#EFF7F2] ${selected ? "bg-[#EFF7F2]" : ""}`}
                role="option"
                aria-selected={selected}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#E5F2EA] text-[#238B57]"><Building2 className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#26312B]">{option.search_name}</strong><small className="block text-[10px] text-[#7A857E]">{option.company_code} · {option.system_number}</small></span>
                {selected && <Check className="h-4 w-4 flex-none text-[#238B57]" />}
              </button>
            );
          })}
          {filtered.length === 0 && <div className="px-3 py-5 text-center text-xs text-[#7A857E]">Company tidak ditemukan.</div>}
        </div>
      )}
      {loadError && <p className="mt-1 text-xs text-red-600">{loadError}</p>}
    </div>
  );
}
