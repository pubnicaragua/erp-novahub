"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

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
import { Badge } from "./badge"

interface MultiSelectProps {
  options: { label: string; value: string; description?: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron resultados.",
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (value: string) => {
    onChange(selected.filter((s) => s !== value))
  }

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-auto min-h-10 px-3 py-2 text-xs bg-background/50 border-border/50 rounded-xl hover:bg-background/80 transition-all",
            className,
            disabled && "opacity-50 cursor-not-allowed bg-muted/50"
          )}
        >
          <div className="flex flex-wrap gap-1 items-center">
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selected.map((val) => {
                  const option = options.find((o) => o.value === val)
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-[10px] font-bold uppercase tracking-tight py-0.5 pl-2 pr-1 gap-1"
                    >
                      {option?.label}
                      <button
                        className="ml-1 rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUnselect(val)
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={() => handleUnselect(val)}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            ) : (
              <span className="text-muted-foreground/60">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 rounded-xl border-border/50 shadow-2xl backdrop-blur-xl bg-background/95" align="start">
        <Command className="bg-transparent">
          <CommandInput placeholder="Buscar usuario..." className="h-10 text-xs border-none" />
          <CommandList className="max-h-60 no-scrollbar">
            <CommandEmpty className="text-xs py-6 font-medium text-muted-foreground">{emptyMessage}</CommandEmpty>
            <CommandGroup className="p-2">
              <AnimatePresence>
                {options.map((option) => {
                  const isSelected = selected.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className={cn(
                        "text-xs rounded-lg mb-1 py-2 cursor-pointer transition-colors",
                        isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded border border-primary transition-all",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-transparent opacity-50"
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="leading-tight">{option.label}</span>
                        {option.description && (
                          <span className={cn(
                            "text-[10px] transition-colors",
                            isSelected ? "text-primary/70" : "text-muted-foreground"
                          )}>
                            {option.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  )
                })}
              </AnimatePresence>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
