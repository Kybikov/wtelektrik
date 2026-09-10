import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, MapPin, Search, X } from "lucide-react";
import AnimatedContent from "./AnimatedContent/AnimatedContent";
import { t } from "../i18n";
type Option = { id: string; label: string };
export function Picker({
  label,
  value = "",
  options,
  onChange,
  freeText = false,
  disabled = false,
  multiple = false,
}: {
  label: string;
  value?: string;
  options: Option[];
  onChange: (value: string) => void;
  freeText?: boolean;
  disabled?: boolean;
  multiple?: boolean;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(-1);
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const [above, setAbove] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const bounds = root.current?.getBoundingClientRect();
      if (!bounds) return;
      const viewport = window.visualViewport;
      const bottom =
        (viewport?.height || window.innerHeight) + (viewport?.offsetTop || 0);
      setAbove(
        bottom - bounds.bottom < 340 && bounds.top > bottom - bounds.bottom,
      );
    };
    position();
    window.visualViewport?.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.visualViewport?.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  const normalized = query
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const all = freeText
    ? options
    : [
        { id: "", label: t("Усі варіанти") },
        ...options.map((o) => ({ ...o, label: t(o.label) })),
      ];
  const shown = freeText
    ? all
    : all.filter(
        (o) =>
          !normalized ||
          o.label
            .toLocaleLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .includes(normalized),
      );
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    setActive(-1);
  }, [query, value]);
  useEffect(() => {
    if (open && !freeText) input.current?.focus();
  }, [open, freeText]);
  useEffect(() => {
    if (active >= 0)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, id]);
  const selected = new Set(value.split(",").filter(Boolean));
  const displayValue =
    multiple && selected.size > 1
      ? t("Обрано: {count}", { count: selected.size })
      : t(options.find((o) => o.id === value)?.label || "Усі варіанти");
  function choose(option: Option) {
    if (multiple) {
      if (!option.id) selected.clear();
      else if (selected.has(option.id)) selected.delete(option.id);
      else selected.add(option.id);
      onChange([...selected].join(","));
      return;
    }
    onChange(option.id);
    setOpen(false);
    setQuery("");
    if (!freeText) trigger.current?.focus();
  }
  function keys(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Tab") setOpen(false);
    else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setActive((n) =>
        Math.max(
          0,
          Math.min(shown.length - 1, n + (event.key === "ArrowDown" ? 1 : -1)),
        ),
      );
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (active >= 0 && shown[active]) choose(shown[active]);
      else if (freeText) setOpen(false);
    }
  }
  const popup = (
    <div className="picker-content">
      {!freeText && (
        <div className="picker-search">
          <Search size={16} />
          <input
            ref={input}
            aria-label={t("Шукати варіант")}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-activedescendant={
              active >= 0 ? `${id}-option-${active}` : undefined
            }
            autoComplete="off"
            value={query}
            onKeyDown={keys}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Шукати варіант…")}
          />
        </div>
      )}
      <div
        id={`${id}-list`}
        role="listbox"
        aria-multiselectable={multiple || undefined}
        aria-label={label}
        className="picker-options"
      >
        {shown.map((option, index) => (
          <button
            type="button"
            id={`${id}-option-${index}`}
            key={option.id}
            role="option"
            aria-selected={
              multiple
                ? !option.id
                  ? !selected.size
                  : selected.has(option.id)
                : option.id === value
            }
            tabIndex={-1}
            className={active === index ? "highlighted" : ""}
            onPointerDown={(e) => e.preventDefault()}
            onPointerMove={() => setActive(index)}
            onClick={() => choose(option)}
          >
            <span>{option.label}</span>
            {(multiple
              ? !option.id
                ? !selected.size
                : selected.has(option.id)
              : option.id === value) && <Check size={16} />}
          </button>
        ))}
        {!shown.length && (
          <p className="picker-empty">
            {t(
              freeText
                ? "Можна шукати за введеним містом або індексом."
                : "Немає збігів. Спробуй іншу назву.",
            )}
          </p>
        )}
      </div>
      {multiple && (
        <button
          type="button"
          className="picker-done"
          onClick={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        >
          {t("Готово")}
        </button>
      )}
      {freeText && (
        <p className="picker-hint">
          {t("До 6 підказок. Уточни місто або введи індекс.")}
        </p>
      )}
    </div>
  );
  return (
    <div
      className={"picker-field " + (disabled ? "disabled" : "")}
      ref={root}
      onBlur={(e) => {
        if (e.relatedTarget && !root.current?.contains(e.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <label id={`${id}-label`} htmlFor={`${id}-input`}>
        {label}
      </label>
      {freeText ? (
        <div className="picker-trigger picker-location">
          <MapPin size={17} />
          <input
            ref={input}
            id={`${id}-input`}
            role="combobox"
            aria-expanded={open && !disabled}
            aria-autocomplete="list"
            aria-controls={`${id}-list`}
            aria-activedescendant={
              active >= 0 ? `${id}-option-${active}` : undefined
            }
            disabled={disabled}
            autoComplete="off"
            value={value}
            placeholder={t("Наприклад, Berlin")}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={keys}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
          />
          {value && !disabled && (
            <button
              type="button"
              className="picker-clear"
              aria-label={t("Очистити місце")}
              onClick={() => onChange("")}
            >
              <X size={15} />
            </button>
          )}
        </div>
      ) : (
        <button
          ref={trigger}
          id={`${id}-input`}
          type="button"
          className="picker-trigger"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => {
            setQuery("");
            setOpen((v) => !v);
          }}
          onKeyDown={keys}
        >
          <span id={`${id}-value`}>{displayValue}</span>
          <ChevronDown size={16} />
        </button>
      )}
      {open && !disabled && (
        <div className={"picker-popup" + (above ? " above" : "")}>
          {reduceMotion ? (
            popup
          ) : (
            <AnimatedContent
              distance={6}
              duration={0.18}
              threshold={0}
              initialOpacity={0.5}
              animateOpacity
              scale={1}
              delay={0}
            >
              {popup}
            </AnimatedContent>
          )}
        </div>
      )}
    </div>
  );
}
