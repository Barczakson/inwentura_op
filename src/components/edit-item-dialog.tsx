'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getUnitsByCategory } from '@/lib/unit-conversion'

interface EditItemDialogProps {
  isOpen: boolean
  onClose: () => void
  item: {
    id: string
    itemId?: string
    name: string
    quantity: number
    unit: string
  } | null
  onSave: (updatedItem: {
    id: string
    itemId?: string
    name: string
    quantity: number
    unit: string
  }) => void
}

const commonUnits = getUnitsByCategory('all')

export function EditItemDialog({ isOpen, onClose, item, onSave }: EditItemDialogProps) {
  const [formData, setFormData] = useState({
    itemId: '',
    name: '',
    quantity: '',
    unit: ''
  })

  useEffect(() => {
    if (item) {
      setFormData({
        itemId: item.itemId || '',
        name: item.name,
        quantity: item.quantity.toString(),
        unit: item.unit
      })
    }
  }, [item])

  const handleSave = () => {
    if (!formData.name || !formData.quantity || !formData.unit) {
      return
    }

    onSave({
      id: item!.id,
      itemId: formData.itemId || undefined,
      name: formData.name,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            Make changes to the item details below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="itemId" className="text-right">
              Item ID
            </Label>
            <Input
              id="itemId"
              value={formData.itemId}
              onChange={(e) => setFormData(prev => ({ ...prev, itemId: e.target.value }))}
              className="col-span-3"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unit" className="text-right">
              Unit
            </Label>
            <div className="col-span-3">
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {commonUnits.map(unit => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">
                    Custom...
                  </SelectItem>
                </SelectContent>
              </Select>
              {formData.unit === 'custom' && (
                <Input
                  className="mt-2"
                  placeholder="Enter custom unit"
                  value={formData.unit === 'custom' ? '' : formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                />
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!formData.name || !formData.quantity || !formData.unit}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}