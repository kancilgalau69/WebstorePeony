'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/components/CartProvider'
import { useAuth } from '@/components/AuthProvider'

type NavItem = {
  href: string
  label: string
  icon: string
  activeIcon: string
  external?: boolean
}

export default function BottomNav() {
  const pathname = usePathname()
  const { itemCount } = useCart()
  const { user } = useAuth()

  const blogUrl = process.env.NEXT_PUBLIC_BLOG_URL || ''

  const navItems: NavItem[] = [
    { href: '/', label: 'Shop', icon: 'fa-store', activeIcon: 'fa-store' },
    { href: '/favorites', label: 'Favorit', icon: 'fa-heart', activeIcon: 'fa-heart' },
    { href: '/cart', label: 'Keranjang', icon: 'fa-cart-shopping', activeIcon: 'fa-cart-shopping' },
    { href: '/orders', label: 'Riwayat', icon: 'fa-receipt', activeIcon: 'fa-receipt' },
    {
      href: user ? '/profile' : '/login',
      label: user ? 'Profil' : 'Masuk',
      icon: user ? 'fa-user' : 'fa-right-to-bracket',
      activeIcon: user ? 'fa-user' : 'fa-right-to-bracket',
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-peony border-t-2 border-[#F4D6DC] md:hidden z-50 shadow-2xl">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive =
            !item.external &&
            (pathname === item.href ||
              (item.href === '/login' && (pathname === '/login' || pathname === '/register')) ||
              (item.href === '/profile' && pathname === '/profile'))

          const className = `flex-1 flex flex-col items-center justify-center py-1.5 transition-all relative ${
            isActive ? 'text-[#DB8291]' : 'text-[#9E6B72] hover:text-[#DB8291]'
          }`

          const inner = (
            <>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#DB8291] rounded-b-full shadow-xs" />
              )}
              <span className="relative inline-flex">
                {item.href === '/profile' && user ? (
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive
                        ? 'bg-gradient-to-br from-[#DB8291] to-[#E7A6B1] text-white shadow-xs'
                        : 'bg-[#F4D6DC] text-[#9E6B72]'
                    }`}
                  >
                    {user.nama.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <i className={`fa-solid ${isActive ? item.activeIcon : item.icon} text-lg`}></i>
                )}
                {item.href === '/cart' && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#DB8291] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] mt-1 font-extrabold ${isActive ? 'text-[#DB8291]' : ''}`}>{item.label}</span>
            </>
          )

          if (item.external) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {inner}
              </a>
            )
          }

          return (
            <Link key={item.href} href={item.href} className={className}>
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
