"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "./utils"
import { Button } from "./button"
import { normalizeSearchText } from "../../utils/searchText"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

interface ComboboxProps {
  options: { label: string; value: string; description?: string; disabled?: boolean }[]
  value?: string
  onChange: (value: string) => void
  onSearchChange?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  searchPlaceholder?: string
  maxVisibleOptions?: number
  className?: string
  contentClassName?: string
  disabled?: boolean
  allowCustomValue?: boolean
  ariaLabel?: string
  id?: string
  required?: boolean
  "aria-required"?: boolean
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

export function Combobox({
  options,
  value,
  onChange,
  onSearchChange,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron resultados.",
  searchPlaceholder,
  maxVisibleOptions = 100,
  className,
  contentClassName,
  disabled = false,
  allowCustomValue = false,
  ariaLabel,
  id,
  required,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const pointerSelection = React.useRef<string | null>(null)
  const pendingWheelDelta = React.useRef(0)
  const wheelFrame = React.useRef<number | null>(null)

  const visibleOptions = React.useMemo(() => {
    const query = normalizeSearchText(search)
    if (!query) return options.slice(0, maxVisibleOptions)
    // Con búsqueda activa se muestran todos los resultados,
    // para que cualquier opción del listado sea alcanzable buscando.
    return options
      .filter((option) => normalizeSearchText(`${option.label} ${option.description || ''}`).includes(query))
  }, [maxVisibleOptions, options, search])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch('')
      onSearchChange?.('')
    }
    setOpen(nextOpen)
  }

  const commitSelection = React.useCallback((nextValue: string) => {
    onChange(nextValue === value ? "" : nextValue)
    setOpen(false)
  }, [onChange, value])

  const customValue = search.trim()
  const hasExactOption = React.useMemo(() => {
    const normalizedValue = normalizeSearchText(customValue)
    return Boolean(normalizedValue) && options.some((option) =>
      normalizeSearchText(option.label) === normalizedValue || normalizeSearchText(option.value) === normalizedValue,
    )
  }, [customValue, options])
  const canUseCustomValue = allowCustomValue && Boolean(customValue) && !hasExactOption

  const commitCustomValue = React.useCallback(() => {
    if (!customValue) return
    onChange(customValue)
    setSearch('')
    setOpen(false)
  }, [customValue, onChange])

  React.useEffect(() => () => {
    if (wheelFrame.current !== null) window.cancelAnimationFrame(wheelFrame.current)
  }, [])

  const handleListWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const list = event.currentTarget
    const maxScrollTop = list.scrollHeight - list.clientHeight
    if (maxScrollTop <= 0 || event.deltaY === 0) return

    const canScroll = event.deltaY > 0
      ? list.scrollTop < maxScrollTop
      : list.scrollTop > 0
    if (!canScroll) return

    // Keep the browser's native wheel scrolling whenever possible. Some
    // modal scroll locks prevent that default action, so only in that case
    // accumulate the delta and apply it once per animation frame.
    event.stopPropagation()
    if (!event.defaultPrevented) return

    event.preventDefault()
    pendingWheelDelta.current += event.deltaY
    if (wheelFrame.current !== null) return

    wheelFrame.current = window.requestAnimationFrame(() => {
      wheelFrame.current = null
      const currentMaxScrollTop = list.scrollHeight - list.clientHeight
      const nextScrollTop = list.scrollTop + pendingWheelDelta.current
      pendingWheelDelta.current = 0
      list.scrollTop = Math.max(0, Math.min(currentMaxScrollTop, nextScrollTop))
    })
  }, [])

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-required={ariaRequired ?? required}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between overflow-hidden h-8 text-xs font-medium", className, 
            disabled && "opacity-50 cursor-not-allowed bg-muted/50"
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {value
              ? options.find((option) => option.value === value)?.label || value
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-foreground/70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-full p-0", contentClassName)} align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={(nextSearch) => {
            setSearch(nextSearch)
            onSearchChange?.(nextSearch)
          }} placeholder={searchPlaceholder || placeholder} className="h-8 text-xs" />
          <CommandList
            onWheelCapture={handleListWheel}
            className="touch-pan-y overscroll-contain"
          >
            <CommandEmpty className="text-xs py-2">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {canUseCustomValue && (
                <CommandItem
                  value={`__custom__${customValue}`}
                  onPointerDown={(event) => {
                    if (event.button === 2) return
                    pointerSelection.current = '__custom__'
                    commitCustomValue()
                    window.setTimeout(() => {
                      if (pointerSelection.current === '__custom__') pointerSelection.current = null
                    }, 250)
                  }}
                  onSelect={() => {
                    if (pointerSelection.current === '__custom__') {
                      pointerSelection.current = null
                      return
                    }
                    commitCustomValue()
                  }}
                  className="text-xs"
                >
                  <Plus className="mr-2 h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">Usar “{customValue}”</span>
                </CommandItem>
              )}
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  disabled={option.disabled}
                  value={`${option.label} ${option.description || ''}`}
                  onPointerDown={(event) => {
                    if (option.disabled) return
                    if (event.button === 2) return
                    pointerSelection.current = option.value
                    commitSelection(option.value)
                    window.setTimeout(() => {
                      if (pointerSelection.current === option.value) pointerSelection.current = null
                    }, 250)
                  }}
                  onSelect={() => {
                    if (option.disabled) return
                    if (pointerSelection.current === option.value) {
                      pointerSelection.current = null
                      return
                    }
                    commitSelection(option.value)
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-[9px] text-foreground/70 group-data-[selected=true]:!text-primary-foreground/80">{option.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
