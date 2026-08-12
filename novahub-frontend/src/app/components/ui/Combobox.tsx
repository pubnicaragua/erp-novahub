"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "./utils"
import { Button } from "./button"
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
  placeholder?: string
  emptyMessage?: string
  searchPlaceholder?: string
  maxVisibleOptions?: number
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron resultados.",
  searchPlaceholder,
  maxVisibleOptions = 100,
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const pointerSelection = React.useRef<string | null>(null)

  const visibleOptions = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return options.slice(0, maxVisibleOptions)
    // Con búsqueda activa se muestran todos los resultados (hasta 200),
    // para que cualquier opción del listado sea alcanzable buscando.
    return options
      .filter((option) => `${option.label} ${option.description || ''}`.toLowerCase().includes(query))
      .slice(0, 200)
  }, [maxVisibleOptions, options, search])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSearch('')
    setOpen(nextOpen)
  }

  const commitSelection = React.useCallback((nextValue: string) => {
    onChange(nextValue === value ? "" : nextValue)
    setOpen(false)
  }, [onChange, value])

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between overflow-hidden h-8 text-xs font-medium", className, 
            disabled && "opacity-50 cursor-not-allowed bg-muted/50"
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {value
              ? options.find((option) => option.value === value)?.label
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-foreground/70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder || placeholder} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2">{emptyMessage}</CommandEmpty>
            <CommandGroup>
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
                      <span className="text-[9px] text-foreground/70">{option.description}</span>
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
