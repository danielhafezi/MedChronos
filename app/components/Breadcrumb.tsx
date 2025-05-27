import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav className={`flex items-center text-sm text-medical-neutral-600 ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {/* Home/Dashboard Link */}
        <li>
          <Link 
            href="/"
            className="flex items-center hover:text-medical-primary transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="sr-only">Dashboard</span>
          </Link>
        </li>
        
        {/* Breadcrumb Items */}
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            <ChevronRight className="w-4 h-4 mx-2 text-medical-neutral-400" />
            {item.href && index < items.length - 1 ? (
              <Link 
                href={item.href}
                className="hover:text-medical-primary transition-colors font-medium"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`${index === items.length - 1 ? 'text-medical-neutral-900 font-semibold' : 'text-medical-neutral-600'}`}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
