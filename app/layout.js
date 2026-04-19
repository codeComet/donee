import './globals.css'
import QueryProvider from '@/components/providers/QueryProvider'
import ThemeProvider from '@/components/providers/ThemeProvider'

export const metadata = {
  title: 'Donee — Task Tracker',
  description: 'A collaborative task tracker for modern teams.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%234f46e5'/><path d='M8 17l5 5L24 10' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>",
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
