'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { FiShoppingCart, FiEye, FiSettings, FiCheck, FiX, FiPlus, FiMinus, FiExternalLink, FiTrash2, FiRefreshCw, FiActivity, FiZap, FiShield, FiVolume2, FiBell, FiDownload, FiUpload, FiLoader, FiAlertCircle, FiPackage, FiTrendingUp, FiClock, FiChevronDown, FiLink, FiCopy, FiSearch } from 'react-icons/fi'

// ─── Constants ───────────────────────────────────────────────────────────────
const CART_STRATEGY_AGENT_ID = '6999ea701868c611d86981d3'

const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'] as const
type ProductSize = typeof AVAILABLE_SIZES[number]

// ─── TypeScript Interfaces ───────────────────────────────────────────────────
interface Activity {
  id: string
  productName: string
  status: 'success' | 'failed'
  timestamp: string
  checkoutUrl: string
}

interface MonitoredProduct {
  id: string
  url: string
  name: string
  stockStatus: 'in_stock' | 'sold_out' | 'notify_me' | 'unknown'
  lastChecked: string
  quantity: number
  size: ProductSize
  autoAdd: boolean
}

interface AnalysisResult {
  bypassMethod: string
  cartPayload: {
    productId: string
    variantId: string
    quantity: number
    formAction: string
  }
  checkoutUrl: string
  stockStatus: string
  productInfo: {
    name: string
    price: string
    imageUrl: string
    availability: string
  }
  recommendations: string
  success: boolean
  errorMessage: string
}

// ─── Sample Data ─────────────────────────────────────────────────────────────
const SAMPLE_ACTIVITIES: Activity[] = [
  { id: '1', productName: 'HumanMade Duck Hoodie - Black', status: 'success', timestamp: '14:32:08', checkoutUrl: 'https://humanmade.jp/checkout/abc123' },
  { id: '2', productName: 'HumanMade Tiger Varsity Jacket', status: 'success', timestamp: '13:18:44', checkoutUrl: 'https://humanmade.jp/checkout/def456' },
  { id: '3', productName: 'HumanMade Rug Cushion - Bear', status: 'failed', timestamp: '12:55:21', checkoutUrl: '' },
  { id: '4', productName: 'HumanMade Canvas Tote Bag', status: 'success', timestamp: '11:40:15', checkoutUrl: 'https://humanmade.jp/checkout/ghi789' },
  { id: '5', productName: 'HumanMade Polar Bear Slippers', status: 'success', timestamp: '10:12:03', checkoutUrl: 'https://humanmade.jp/checkout/jkl012' },
]

const SAMPLE_MONITORED: MonitoredProduct[] = [
  { id: '1', url: 'https://humanmade.jp/products/duck-hoodie-black', name: 'HumanMade Duck Hoodie - Black', stockStatus: 'in_stock', lastChecked: '2 min ago', quantity: 1, size: 'L', autoAdd: true },
  { id: '2', url: 'https://humanmade.jp/products/tiger-varsity-jacket', name: 'HumanMade Tiger Varsity Jacket', stockStatus: 'sold_out', lastChecked: '5 min ago', quantity: 1, size: 'M', autoAdd: true },
  { id: '3', url: 'https://humanmade.jp/products/bear-rug-cushion', name: 'HumanMade Rug Cushion - Bear', stockStatus: 'notify_me', lastChecked: '8 min ago', quantity: 2, size: 'XL', autoAdd: false },
]

const SAMPLE_ANALYSIS: AnalysisResult = {
  bypassMethod: 'Direct Form POST - Shopify Add to Cart API',
  cartPayload: { productId: 'gid://shopify/Product/7891234567890', variantId: '43210987654321', quantity: 1, formAction: '/cart/add.js' },
  checkoutUrl: 'https://humanmade.jp/checkout/cn/Z2NwLWFzaWEtbm9ydGhlYXN0MS...',
  stockStatus: 'In Stock',
  productInfo: { name: 'HumanMade Duck Hoodie - Black', price: '\u00A525,300', imageUrl: '', availability: 'In Stock - Limited quantities' },
  recommendations: 'Product is available. Use the direct Shopify /cart/add.js endpoint to bypass client-side stock checks. The product has limited inventory so fast checkout is recommended. Consider enabling auto-checkout to minimize manual steps.',
  success: true,
  errorMessage: '',
}

// ─── Safe Response Mapper ────────────────────────────────────────────────────
function mapResponse(result: any): AnalysisResult | null {
  if (!result?.success || !result?.response?.result) return null
  const data = result.response.result
  return {
    bypassMethod: data?.bypass_method ?? 'Unknown',
    cartPayload: {
      productId: data?.cart_payload?.product_id ?? '',
      variantId: data?.cart_payload?.variant_id ?? '',
      quantity: data?.cart_payload?.quantity ?? 1,
      formAction: data?.cart_payload?.form_action ?? '',
    },
    checkoutUrl: data?.checkout_url ?? '',
    stockStatus: data?.stock_status ?? 'Unknown',
    productInfo: {
      name: data?.product_info?.name ?? 'Unknown Product',
      price: data?.product_info?.price ?? '',
      imageUrl: data?.product_info?.image_url ?? '',
      availability: data?.product_info?.availability ?? '',
    },
    recommendations: data?.recommendations ?? '',
    success: data?.success ?? false,
    errorMessage: data?.error_message ?? '',
  }
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-2 mb-1 text-[hsl(60,30%,96%)]">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-2 mb-1 text-[hsl(60,30%,96%)]">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-3 mb-2 text-[hsl(60,30%,96%)]">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm text-[hsl(60,30%,96%)]">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm text-[hsl(60,30%,96%)]">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm text-[hsl(60,30%,96%)]">{formatInline(line)}</p>
      })}
    </div>
  )
}

// ─── Toggle Switch Component ─────────────────────────────────────────────────
function ToggleSwitch({ enabled, onToggle, size = 'md' }: { enabled: boolean; onToggle: () => void; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6'
  const dotSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const translate = size === 'sm' ? (enabled ? 'translate-x-4' : 'translate-x-0.5') : (enabled ? 'translate-x-5' : 'translate-x-0.5')

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${sizeClasses} relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[hsl(232,16%,18%)] focus:ring-[hsl(265,89%,72%)] ${enabled ? 'bg-[hsl(265,89%,72%)]' : 'bg-[hsl(232,16%,32%)]'}`}
    >
      <span className={`${dotSize} inline-block rounded-full bg-white transition-transform duration-200 ${translate}`} />
    </button>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase() ?? ''
  let colorClasses = 'bg-[hsl(228,10%,22%)] text-[hsl(228,10%,62%)]'
  let dotColor = 'bg-[hsl(228,10%,62%)]'

  if (normalized.includes('in stock') || normalized.includes('in_stock') || normalized === 'success') {
    colorClasses = 'bg-[hsl(135,94%,60%)]/15 text-[hsl(135,94%,60%)]'
    dotColor = 'bg-[hsl(135,94%,60%)]'
  } else if (normalized.includes('sold out') || normalized.includes('sold_out') || normalized === 'failed') {
    colorClasses = 'bg-[hsl(0,100%,62%)]/15 text-[hsl(0,100%,62%)]'
    dotColor = 'bg-[hsl(0,100%,62%)]'
  } else if (normalized.includes('notify') || normalized.includes('notify_me') || normalized.includes('limited')) {
    colorClasses = 'bg-[hsl(31,100%,65%)]/15 text-[hsl(31,100%,65%)]'
    dotColor = 'bg-[hsl(31,100%,65%)]'
  }

  const label = status === 'in_stock' ? 'In Stock' : status === 'sold_out' ? 'Sold Out' : status === 'notify_me' ? 'Notify Me' : status

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-tight ${colorClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 flex flex-col gap-2 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between">
        <span className={`${color} text-lg`}>{icon}</span>
        <span className="text-2xl font-bold tracking-tight text-[hsl(60,30%,96%)]">{value}</span>
      </div>
      <span className="text-xs text-[hsl(228,10%,62%)] tracking-tight">{label}</span>
    </div>
  )
}

// ─── Quantity Stepper ────────────────────────────────────────────────────────
function QuantityStepper({ value, onChange, min = 1, max = 10 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-0 border border-[hsl(232,16%,28%)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="px-2 py-1 bg-[hsl(232,16%,24%)] text-[hsl(60,30%,96%)] hover:bg-[hsl(232,16%,28%)] disabled:opacity-40 transition-colors"
      >
        <FiMinus className="w-3 h-3" />
      </button>
      <span className="px-3 py-1 text-sm font-medium bg-[hsl(232,16%,18%)] text-[hsl(60,30%,96%)] min-w-[2rem] text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="px-2 py-1 bg-[hsl(232,16%,24%)] text-[hsl(60,30%,96%)] hover:bg-[hsl(232,16%,28%)] disabled:opacity-40 transition-colors"
      >
        <FiPlus className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Size Selector ─────────────────────────────────────────────────────────
function SizeSelector({ value, onChange, compact = false }: { value: ProductSize; onChange: (s: ProductSize) => void; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-1'}`}>
      {AVAILABLE_SIZES.map(size => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          className={`px-2 py-1 rounded-md text-xs font-medium transition-all duration-150 border ${
            value === size
              ? 'bg-[hsl(265,89%,72%)] text-white border-[hsl(265,89%,72%)] shadow-sm shadow-[hsl(265,89%,72%)]/30'
              : 'bg-[hsl(232,16%,24%)] text-[hsl(228,10%,62%)] border-[hsl(232,16%,28%)] hover:text-[hsl(60,30%,96%)] hover:border-[hsl(232,16%,38%)]'
          }`}
        >
          {size}
        </button>
      ))}
    </div>
  )
}

// ─── Activity Item ───────────────────────────────────────────────────────────
function ActivityItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[hsl(232,16%,22%)] transition-colors group">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activity.status === 'success' ? 'bg-[hsl(135,94%,60%)]/15' : 'bg-[hsl(0,100%,62%)]/15'}`}>
        {activity.status === 'success' ? (
          <FiCheck className="w-4 h-4 text-[hsl(135,94%,60%)]" />
        ) : (
          <FiX className="w-4 h-4 text-[hsl(0,100%,62%)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[hsl(60,30%,96%)] truncate tracking-tight">{activity.productName}</p>
        <p className="text-xs text-[hsl(228,10%,62%)]">{activity.timestamp}</p>
      </div>
      {activity.checkoutUrl && (
        <a href={activity.checkoutUrl} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity text-[hsl(191,97%,70%)] hover:text-[hsl(191,97%,80%)]">
          <FiExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  )
}

// ─── Monitor Card ────────────────────────────────────────────────────────────
function MonitorCard({ product, onRemove, onQuantityChange, onSizeChange, onToggleAutoAdd, onCheckNow, checkingId }: {
  product: MonitoredProduct
  onRemove: (id: string) => void
  onQuantityChange: (id: string, qty: number) => void
  onSizeChange: (id: string, size: ProductSize) => void
  onToggleAutoAdd: (id: string) => void
  onCheckNow: (id: string) => void
  checkingId: string | null
}) {
  const isChecking = checkingId === product.id
  return (
    <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="text-sm font-semibold text-[hsl(60,30%,96%)] tracking-tight truncate">{product.name}</h3>
          <p className="text-xs text-[hsl(228,10%,62%)] truncate mt-0.5">{product.url}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(product.id)}
          className="text-[hsl(228,10%,62%)] hover:text-[hsl(0,100%,62%)] transition-colors flex-shrink-0"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <StatusBadge status={product.stockStatus} />
        <span className="text-xs text-[hsl(228,10%,62%)] flex items-center gap-1">
          <FiClock className="w-3 h-3" />
          {product.lastChecked}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[hsl(228,10%,62%)]">Qty:</span>
          <QuantityStepper value={product.quantity} onChange={(v) => onQuantityChange(product.id, v)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[hsl(228,10%,62%)]">Auto-add</span>
          <ToggleSwitch size="sm" enabled={product.autoAdd} onToggle={() => onToggleAutoAdd(product.id)} />
        </div>
      </div>

      <div className="mb-3">
        <span className="text-xs text-[hsl(228,10%,62%)] mb-1.5 block">Size:</span>
        <SizeSelector compact value={product.size} onChange={(s) => onSizeChange(product.id, s)} />
      </div>

      <button
        type="button"
        onClick={() => onCheckNow(product.id)}
        disabled={isChecking}
        className="w-full py-2 rounded-lg bg-[hsl(232,16%,28%)] text-[hsl(60,30%,96%)] text-xs font-medium hover:bg-[hsl(232,16%,32%)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isChecking ? (
          <><FiLoader className="w-3 h-3 animate-spin" /> Checking...</>
        ) : (
          <><FiRefreshCw className="w-3 h-3" /> Check Now</>
        )}
      </button>
    </div>
  )
}

// ─── Analysis Display ────────────────────────────────────────────────────────
function AnalysisDisplay({ data, loading }: { data: AnalysisResult | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center gap-3 justify-center text-[hsl(265,89%,72%)]">
          <FiLoader className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium tracking-tight">Analyzing product page...</span>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/4 rounded bg-[hsl(232,16%,28%)] animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-[hsl(232,16%,28%)] animate-pulse" />
          <div className="h-16 w-full rounded-lg bg-[hsl(232,16%,28%)] animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-[hsl(232,16%,28%)] animate-pulse" />
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-3 mt-3">
      {/* Error State */}
      {data.errorMessage && (
        <div className="bg-[hsl(0,100%,62%)]/10 border border-[hsl(0,100%,62%)]/30 rounded-[0.875rem] p-3 flex items-start gap-2">
          <FiAlertCircle className="w-4 h-4 text-[hsl(0,100%,62%)] flex-shrink-0 mt-0.5" />
          <span className="text-sm text-[hsl(0,100%,62%)]">{data.errorMessage}</span>
        </div>
      )}

      {/* Product Info + Stock */}
      <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 mr-3">
            <h3 className="text-sm font-semibold text-[hsl(60,30%,96%)] tracking-tight">{data.productInfo.name}</h3>
            {data.productInfo.price && (
              <p className="text-lg font-bold text-[hsl(265,89%,72%)] mt-1">{data.productInfo.price}</p>
            )}
          </div>
          <StatusBadge status={data.stockStatus} />
        </div>
        {data.productInfo.availability && (
          <p className="text-xs text-[hsl(228,10%,62%)] mt-1">{data.productInfo.availability}</p>
        )}
      </div>

      {/* Bypass Method */}
      <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 mb-2">
          <FiZap className="w-4 h-4 text-[hsl(31,100%,65%)]" />
          <span className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider">Bypass Method</span>
        </div>
        <p className="text-sm text-[hsl(60,30%,96%)] font-medium">{data.bypassMethod}</p>
      </div>

      {/* Cart Payload */}
      <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 mb-3">
          <FiPackage className="w-4 h-4 text-[hsl(191,97%,70%)]" />
          <span className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider">Cart Payload</span>
        </div>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between bg-[hsl(232,16%,18%)] rounded-lg px-3 py-2">
            <span className="text-[hsl(326,100%,68%)]">product_id</span>
            <span className="text-[hsl(135,94%,60%)] truncate ml-2 max-w-[200px]">{data.cartPayload.productId || '-'}</span>
          </div>
          <div className="flex items-center justify-between bg-[hsl(232,16%,18%)] rounded-lg px-3 py-2">
            <span className="text-[hsl(326,100%,68%)]">variant_id</span>
            <span className="text-[hsl(135,94%,60%)] truncate ml-2 max-w-[200px]">{data.cartPayload.variantId || '-'}</span>
          </div>
          <div className="flex items-center justify-between bg-[hsl(232,16%,18%)] rounded-lg px-3 py-2">
            <span className="text-[hsl(326,100%,68%)]">quantity</span>
            <span className="text-[hsl(135,94%,60%)]">{data.cartPayload.quantity}</span>
          </div>
          <div className="flex items-center justify-between bg-[hsl(232,16%,18%)] rounded-lg px-3 py-2">
            <span className="text-[hsl(326,100%,68%)]">form_action</span>
            <span className="text-[hsl(135,94%,60%)] truncate ml-2 max-w-[200px]">{data.cartPayload.formAction || '-'}</span>
          </div>
        </div>
      </div>

      {/* Checkout URL */}
      {data.checkoutUrl && (
        <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 mb-2">
            <FiLink className="w-4 h-4 text-[hsl(191,97%,70%)]" />
            <span className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider">Checkout URL</span>
          </div>
          <a
            href={data.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[hsl(191,97%,70%)] hover:underline break-all flex items-center gap-1"
          >
            {data.checkoutUrl.length > 50 ? data.checkoutUrl.slice(0, 50) + '...' : data.checkoutUrl}
            <FiExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations && (
        <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 mb-2">
            <FiTrendingUp className="w-4 h-4 text-[hsl(135,94%,60%)]" />
            <span className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider">Recommendations</span>
          </div>
          {renderMarkdown(data.recommendations)}
        </div>
      )}
    </div>
  )
}

// ─── Error Boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[hsl(231,18%,14%)] text-[hsl(60,30%,96%)]">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-[hsl(228,10%,62%)] mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-[hsl(265,89%,72%)] text-white rounded-[0.875rem] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Page() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monitor' | 'settings'>('dashboard')

  // Sample data toggle
  const [showSampleData, setShowSampleData] = useState(false)

  // Dashboard state
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [selectedSize, setSelectedSize] = useState<ProductSize>('M')
  const [loading, setLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  // Monitor state
  const [monitorUrl, setMonitorUrl] = useState('')
  const [monitoredProducts, setMonitoredProducts] = useState<MonitoredProduct[]>([])
  const [checkInterval, setCheckInterval] = useState('15')
  const [checkingId, setCheckingId] = useState<string | null>(null)

  // Settings state
  const [defaultQuantity, setDefaultQuantity] = useState(1)
  const [defaultSize, setDefaultSize] = useState<ProductSize>('M')
  const [autoCheckout, setAutoCheckout] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [desktopNotifications, setDesktopNotifications] = useState(true)
  const [bypassMode, setBypassMode] = useState<'aggressive' | 'standard'>('standard')

  // Agent status
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Apply sample data
  useEffect(() => {
    if (showSampleData) {
      setActivities(SAMPLE_ACTIVITIES)
      setMonitoredProducts(SAMPLE_MONITORED)
      setAnalysisResult(SAMPLE_ANALYSIS)
      setUrlInput('https://humanmade.jp/products/duck-hoodie-black')
    } else {
      setActivities([])
      setMonitoredProducts([])
      setAnalysisResult(null)
      setUrlInput('')
      setErrorMsg('')
    }
  }, [showSampleData])

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async (url: string) => {
    if (!url.trim()) return
    setLoading(true)
    setErrorMsg('')
    setAnalysisResult(null)
    setActiveAgentId(CART_STRATEGY_AGENT_ID)
    try {
      const result = await callAIAgent(
        `Analyze this humanmade.jp product page and determine the add-to-cart strategy. Target size: ${selectedSize}. URL: ${url}`,
        CART_STRATEGY_AGENT_ID
      )
      const mapped = mapResponse(result)
      if (mapped) {
        setAnalysisResult(mapped)
        setActivities(prev => [{
          id: Date.now().toString(),
          productName: mapped.productInfo?.name ?? 'Unknown Product',
          status: mapped.success ? 'success' : 'failed',
          timestamp: new Date().toLocaleTimeString(),
          checkoutUrl: mapped.checkoutUrl ?? '',
        }, ...prev])
      } else {
        setErrorMsg(result?.error ?? result?.response?.message ?? 'Failed to analyze product page. Please try again.')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [selectedSize])

  const handleAddMonitor = useCallback(() => {
    if (!monitorUrl.trim()) return
    const newProduct: MonitoredProduct = {
      id: Date.now().toString(),
      url: monitorUrl,
      name: monitorUrl.split('/').pop()?.replace(/-/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) ?? 'New Product',
      stockStatus: 'unknown',
      lastChecked: 'Never',
      quantity: defaultQuantity,
      size: defaultSize,
      autoAdd: false,
    }
    setMonitoredProducts(prev => [newProduct, ...prev])
    setMonitorUrl('')
  }, [monitorUrl, defaultQuantity, defaultSize])

  const handleCheckNow = useCallback(async (id: string) => {
    const product = monitoredProducts.find(p => p.id === id)
    if (!product) return
    setCheckingId(id)
    setActiveAgentId(CART_STRATEGY_AGENT_ID)
    try {
      const result = await callAIAgent(
        `Analyze this humanmade.jp product page and determine the add-to-cart strategy. Target size: ${product.size}. URL: ${product.url}`,
        CART_STRATEGY_AGENT_ID
      )
      const mapped = mapResponse(result)
      if (mapped) {
        setMonitoredProducts(prev => prev.map(p => {
          if (p.id !== id) return p
          let stockStatus: MonitoredProduct['stockStatus'] = 'unknown'
          const st = mapped.stockStatus?.toLowerCase() ?? ''
          if (st.includes('in stock')) stockStatus = 'in_stock'
          else if (st.includes('sold out')) stockStatus = 'sold_out'
          else if (st.includes('notify')) stockStatus = 'notify_me'
          return { ...p, stockStatus, lastChecked: 'Just now', name: mapped.productInfo?.name ?? p.name }
        }))
      }
    } catch {
      // silently handle
    } finally {
      setCheckingId(null)
      setActiveAgentId(null)
    }
  }, [monitoredProducts])

  const handleRemoveMonitor = useCallback((id: string) => {
    setMonitoredProducts(prev => prev.filter(p => p.id !== id))
  }, [])

  const handleQuantityChange = useCallback((id: string, qty: number) => {
    setMonitoredProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: qty } : p))
  }, [])

  const handleSizeChange = useCallback((id: string, size: ProductSize) => {
    setMonitoredProducts(prev => prev.map(p => p.id === id ? { ...p, size } : p))
  }, [])

  const handleToggleAutoAdd = useCallback((id: string) => {
    setMonitoredProducts(prev => prev.map(p => p.id === id ? { ...p, autoAdd: !p.autoAdd } : p))
  }, [])

  // Stats
  const successCount = activities.filter(a => a.status === 'success').length
  const totalCount = activities.length
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0
  const activeMonitors = monitoredProducts.length

  // Tab config
  const tabs: { key: 'dashboard' | 'monitor' | 'settings'; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <FiActivity className="w-4 h-4" /> },
    { key: 'monitor', label: 'Monitor', icon: <FiEye className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <FiSettings className="w-4 h-4" /> },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[hsl(231,18%,14%)] flex items-start justify-center py-8 px-4">
        {/* Extension Popup Container */}
        <div className="w-full max-w-[480px] min-h-[600px] bg-[hsl(232,16%,18%)] rounded-[0.875rem] shadow-2xl shadow-black/50 border border-[hsl(232,16%,28%)] flex flex-col overflow-hidden">

          {/* ─── Header ──────────────────────────────────────────────────── */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[0.625rem] bg-[hsl(265,89%,72%)]/20 flex items-center justify-center">
                  <FiShoppingCart className="w-5 h-5 text-[hsl(265,89%,72%)]" />
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-[hsl(60,30%,96%)]">HumanMade Auto Cart</h1>
                  <p className="text-xs text-[hsl(228,10%,62%)]">Chrome Extension Dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Sample Data Toggle */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[hsl(228,10%,62%)]">Sample</span>
                  <ToggleSwitch size="sm" enabled={showSampleData} onToggle={() => setShowSampleData(prev => !prev)} />
                </div>
                {/* Global Toggle */}
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium ${globalEnabled ? 'text-[hsl(135,94%,60%)]' : 'text-[hsl(228,10%,62%)]'}`}>
                    {globalEnabled ? 'ON' : 'OFF'}
                  </span>
                  <ToggleSwitch enabled={globalEnabled} onToggle={() => setGlobalEnabled(prev => !prev)} />
                </div>
              </div>
            </div>

            {/* ─── Tab Navigation ────────────────────────────────────────── */}
            <div className="flex gap-1 bg-[hsl(232,16%,14%)] rounded-[0.625rem] p-1">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 tracking-tight ${activeTab === tab.key ? 'bg-[hsl(265,89%,72%)] text-white shadow-md shadow-[hsl(265,89%,72%)]/30' : 'text-[hsl(228,10%,62%)] hover:text-[hsl(60,30%,96%)] hover:bg-[hsl(232,16%,24%)]'}`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Content Area ────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">

            {/* ══════════════════ DASHBOARD TAB ══════════════════ */}
            {activeTab === 'dashboard' && (
              <div className="space-y-4 pt-2">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    icon={<FiShoppingCart />}
                    value={successCount}
                    label="Added Today"
                    color="text-[hsl(135,94%,60%)]"
                  />
                  <StatCard
                    icon={<FiEye />}
                    value={activeMonitors}
                    label="Monitors"
                    color="text-[hsl(191,97%,70%)]"
                  />
                  <StatCard
                    icon={<FiTrendingUp />}
                    value={`${successRate}%`}
                    label="Success Rate"
                    color="text-[hsl(265,89%,72%)]"
                  />
                </div>

                {/* URL Input */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <label className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider mb-2 block">Analyze Product Page</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(228,10%,62%)]" />
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(urlInput) }}
                        placeholder="https://humanmade.jp/products/..."
                        className="w-full pl-9 pr-3 py-2.5 bg-[hsl(232,16%,32%)] border border-[hsl(232,16%,28%)] rounded-lg text-sm text-[hsl(60,30%,96%)] placeholder:text-[hsl(228,10%,42%)] focus:outline-none focus:ring-2 focus:ring-[hsl(265,89%,72%)] focus:border-transparent transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAnalyze(urlInput)}
                      disabled={loading || !urlInput.trim()}
                      className="px-4 py-2.5 bg-[hsl(265,89%,72%)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2 flex-shrink-0"
                    >
                      {loading ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiZap className="w-4 h-4" />}
                      Analyze
                    </button>
                  </div>
                  <div className="mt-3">
                    <span className="text-xs text-[hsl(228,10%,62%)] mb-1.5 block">Target Size:</span>
                    <SizeSelector value={selectedSize} onChange={setSelectedSize} />
                  </div>
                </div>

                {/* Error Message */}
                {errorMsg && !loading && (
                  <div className="bg-[hsl(0,100%,62%)]/10 border border-[hsl(0,100%,62%)]/30 rounded-[0.875rem] p-3 flex items-start gap-2">
                    <FiAlertCircle className="w-4 h-4 text-[hsl(0,100%,62%)] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-[hsl(0,100%,62%)]">{errorMsg}</span>
                  </div>
                )}

                {/* Analysis Results */}
                <AnalysisDisplay data={analysisResult} loading={loading} />

                {/* Go to Checkout CTA */}
                {analysisResult?.checkoutUrl && !loading && (
                  <a
                    href={analysisResult.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-[hsl(135,94%,60%)] text-[hsl(231,18%,10%)] rounded-[0.875rem] text-sm font-bold tracking-tight hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-[hsl(135,94%,60%)]/20"
                  >
                    <FiShoppingCart className="w-4 h-4" />
                    Go to Checkout
                    <FiExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Recent Activity */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FiActivity className="w-4 h-4 text-[hsl(265,89%,72%)]" />
                      <span className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider">Recent Activity</span>
                    </div>
                    {activities.length > 0 && (
                      <span className="text-xs text-[hsl(228,10%,62%)]">{activities.length} total</span>
                    )}
                  </div>
                  {activities.length === 0 ? (
                    <div className="text-center py-6">
                      <FiShoppingCart className="w-8 h-8 text-[hsl(232,16%,32%)] mx-auto mb-2" />
                      <p className="text-sm text-[hsl(228,10%,62%)]">No activity yet</p>
                      <p className="text-xs text-[hsl(228,10%,42%)] mt-1">Analyze a product page to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5 max-h-[240px] overflow-y-auto">
                      {activities.map(activity => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════ MONITOR TAB ══════════════════ */}
            {activeTab === 'monitor' && (
              <div className="space-y-4 pt-2">
                {/* Add Product */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <label className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider mb-2 block">Add Product to Monitor</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={monitorUrl}
                      onChange={(e) => setMonitorUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddMonitor() }}
                      placeholder="https://humanmade.jp/products/..."
                      className="flex-1 px-3 py-2.5 bg-[hsl(232,16%,32%)] border border-[hsl(232,16%,28%)] rounded-lg text-sm text-[hsl(60,30%,96%)] placeholder:text-[hsl(228,10%,42%)] focus:outline-none focus:ring-2 focus:ring-[hsl(265,89%,72%)] focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddMonitor}
                      disabled={!monitorUrl.trim()}
                      className="px-4 py-2.5 bg-[hsl(265,89%,72%)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5 flex-shrink-0"
                    >
                      <FiPlus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Check Interval */}
                <div className="flex items-center justify-between bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] px-4 py-3 shadow-lg shadow-black/20">
                  <div className="flex items-center gap-2">
                    <FiClock className="w-4 h-4 text-[hsl(191,97%,70%)]" />
                    <span className="text-sm text-[hsl(60,30%,96%)] font-medium tracking-tight">Check Interval</span>
                  </div>
                  <div className="relative">
                    <select
                      value={checkInterval}
                      onChange={(e) => setCheckInterval(e.target.value)}
                      className="appearance-none bg-[hsl(232,16%,32%)] border border-[hsl(232,16%,28%)] text-[hsl(60,30%,96%)] text-sm rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[hsl(265,89%,72%)] cursor-pointer"
                    >
                      <option value="5">5 min</option>
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="60">1 hour</option>
                    </select>
                    <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(228,10%,62%)] pointer-events-none" />
                  </div>
                </div>

                {/* Monitored Products */}
                {monitoredProducts.length === 0 ? (
                  <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-8 text-center shadow-lg shadow-black/20">
                    <FiEye className="w-10 h-10 text-[hsl(232,16%,32%)] mx-auto mb-3" />
                    <p className="text-sm font-medium text-[hsl(60,30%,96%)] tracking-tight">No products monitored</p>
                    <p className="text-xs text-[hsl(228,10%,62%)] mt-1">Add a product URL above to start monitoring stock</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {monitoredProducts.map(product => (
                      <MonitorCard
                        key={product.id}
                        product={product}
                        onRemove={handleRemoveMonitor}
                        onQuantityChange={handleQuantityChange}
                        onSizeChange={handleSizeChange}
                        onToggleAutoAdd={handleToggleAutoAdd}
                        onCheckNow={handleCheckNow}
                        checkingId={checkingId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ SETTINGS TAB ══════════════════ */}
            {activeTab === 'settings' && (
              <div className="space-y-3 pt-2">
                {/* Default Quantity */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[hsl(60,30%,96%)] tracking-tight">Default Quantity</h3>
                      <p className="text-xs text-[hsl(228,10%,62%)] mt-0.5">Quantity for new monitored products</p>
                    </div>
                    <QuantityStepper value={defaultQuantity} onChange={setDefaultQuantity} />
                  </div>
                </div>

                {/* Default Size */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-[hsl(60,30%,96%)] tracking-tight">Default Size</h3>
                    <p className="text-xs text-[hsl(228,10%,62%)] mt-0.5">Size for new monitored products</p>
                  </div>
                  <SizeSelector value={defaultSize} onChange={setDefaultSize} />
                </div>

                {/* Auto-Checkout */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[hsl(60,30%,96%)] tracking-tight">Auto-Checkout</h3>
                      <p className="text-xs text-[hsl(228,10%,62%)] mt-0.5">Automatically redirect to checkout after add</p>
                    </div>
                    <ToggleSwitch enabled={autoCheckout} onToggle={() => setAutoCheckout(prev => !prev)} />
                  </div>
                </div>

                {/* Notification Preferences */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20 space-y-4">
                  <h3 className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider">Notifications</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiVolume2 className="w-4 h-4 text-[hsl(265,89%,72%)]" />
                      <span className="text-sm text-[hsl(60,30%,96%)]">Sound alerts</span>
                    </div>
                    <ToggleSwitch enabled={soundEnabled} onToggle={() => setSoundEnabled(prev => !prev)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiBell className="w-4 h-4 text-[hsl(191,97%,70%)]" />
                      <span className="text-sm text-[hsl(60,30%,96%)]">Desktop notifications</span>
                    </div>
                    <ToggleSwitch enabled={desktopNotifications} onToggle={() => setDesktopNotifications(prev => !prev)} />
                  </div>
                </div>

                {/* Bypass Mode */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <h3 className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider mb-3">Bypass Mode</h3>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setBypassMode('standard')}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${bypassMode === 'standard' ? 'border-[hsl(265,89%,72%)] bg-[hsl(265,89%,72%)]/10' : 'border-[hsl(232,16%,28%)] bg-[hsl(232,16%,18%)] hover:border-[hsl(232,16%,38%)]'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${bypassMode === 'standard' ? 'border-[hsl(265,89%,72%)]' : 'border-[hsl(228,10%,62%)]'}`}>
                        {bypassMode === 'standard' && <div className="w-2 h-2 rounded-full bg-[hsl(265,89%,72%)]" />}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <FiShield className="w-4 h-4 text-[hsl(191,97%,70%)]" />
                          <span className="text-sm font-medium text-[hsl(60,30%,96%)]">Standard</span>
                        </div>
                        <p className="text-xs text-[hsl(228,10%,62%)] mt-0.5 ml-6">Smart detection with safe fallbacks</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBypassMode('aggressive')}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${bypassMode === 'aggressive' ? 'border-[hsl(265,89%,72%)] bg-[hsl(265,89%,72%)]/10' : 'border-[hsl(232,16%,28%)] bg-[hsl(232,16%,18%)] hover:border-[hsl(232,16%,38%)]'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${bypassMode === 'aggressive' ? 'border-[hsl(265,89%,72%)]' : 'border-[hsl(228,10%,62%)]'}`}>
                        {bypassMode === 'aggressive' && <div className="w-2 h-2 rounded-full bg-[hsl(265,89%,72%)]" />}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <FiZap className="w-4 h-4 text-[hsl(31,100%,65%)]" />
                          <span className="text-sm font-medium text-[hsl(60,30%,96%)]">Aggressive</span>
                        </div>
                        <p className="text-xs text-[hsl(228,10%,62%)] mt-0.5 ml-6">Force add-to-cart, bypass all checks</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Export / Import */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <h3 className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider mb-3">Data</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const data = JSON.stringify({ monitoredProducts, settings: { defaultQuantity, defaultSize, autoCheckout, soundEnabled, desktopNotifications, bypassMode, checkInterval } }, null, 2)
                        const blob = new Blob([data], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'humanmade-autocart-settings.json'
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="flex-1 py-2.5 bg-[hsl(232,16%,28%)] text-[hsl(60,30%,96%)] rounded-lg text-sm font-medium hover:bg-[hsl(232,16%,32%)] transition-colors flex items-center justify-center gap-2"
                    >
                      <FiDownload className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = '.json'
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = (ev) => {
                            try {
                              const parsed = JSON.parse(ev.target?.result as string)
                              if (Array.isArray(parsed?.monitoredProducts)) {
                                setMonitoredProducts(parsed.monitoredProducts)
                              }
                              if (parsed?.settings) {
                                if (typeof parsed.settings.defaultQuantity === 'number') setDefaultQuantity(parsed.settings.defaultQuantity)
                                if (parsed.settings.defaultSize && AVAILABLE_SIZES.includes(parsed.settings.defaultSize)) setDefaultSize(parsed.settings.defaultSize)
                                if (typeof parsed.settings.autoCheckout === 'boolean') setAutoCheckout(parsed.settings.autoCheckout)
                                if (typeof parsed.settings.soundEnabled === 'boolean') setSoundEnabled(parsed.settings.soundEnabled)
                                if (typeof parsed.settings.desktopNotifications === 'boolean') setDesktopNotifications(parsed.settings.desktopNotifications)
                                if (parsed.settings.bypassMode === 'aggressive' || parsed.settings.bypassMode === 'standard') setBypassMode(parsed.settings.bypassMode)
                                if (typeof parsed.settings.checkInterval === 'string') setCheckInterval(parsed.settings.checkInterval)
                              }
                            } catch {
                              // invalid JSON
                            }
                          }
                          reader.readAsText(file)
                        }
                        input.click()
                      }}
                      className="flex-1 py-2.5 bg-[hsl(232,16%,28%)] text-[hsl(60,30%,96%)] rounded-lg text-sm font-medium hover:bg-[hsl(232,16%,32%)] transition-colors flex items-center justify-center gap-2"
                    >
                      <FiUpload className="w-4 h-4" />
                      Import
                    </button>
                  </div>
                </div>

                {/* Agent Info */}
                <div className="bg-[hsl(232,16%,22%)] border border-[hsl(232,16%,28%)] rounded-[0.875rem] p-4 shadow-lg shadow-black/20">
                  <h3 className="text-xs font-semibold text-[hsl(228,10%,62%)] uppercase tracking-wider mb-3">Agent Status</h3>
                  <div className="flex items-center gap-3 bg-[hsl(232,16%,18%)] rounded-lg p-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[hsl(265,89%,72%)]/20 flex items-center justify-center">
                        <FiZap className="w-4 h-4 text-[hsl(265,89%,72%)]" />
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[hsl(232,16%,18%)] ${activeAgentId ? 'bg-[hsl(31,100%,65%)] animate-pulse' : 'bg-[hsl(135,94%,60%)]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[hsl(60,30%,96%)] tracking-tight">Cart Strategy Agent</p>
                      <p className="text-xs text-[hsl(228,10%,62%)]">
                        {activeAgentId ? 'Processing...' : 'Ready'}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[hsl(228,10%,42%)]">
                      {CART_STRATEGY_AGENT_ID.slice(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Footer ──────────────────────────────────────────────────── */}
          <div className="px-5 py-3 border-t border-[hsl(232,16%,28%)] flex items-center justify-between">
            <span className="text-xs text-[hsl(228,10%,42%)] tracking-tight">HumanMade.jp Auto Cart v1.0</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${globalEnabled ? 'bg-[hsl(135,94%,60%)]' : 'bg-[hsl(0,100%,62%)]'}`} />
              <span className="text-xs text-[hsl(228,10%,62%)]">{globalEnabled ? 'Active' : 'Disabled'}</span>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
