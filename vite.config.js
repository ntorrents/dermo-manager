import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_react: ["react", "react-dom"],
          vendor_supabase: ["@supabase/supabase-js"],
          vendor_calendar: ["react-big-calendar", "date-fns"],
          vendor_editor: [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "mammoth",
            "dompurify",
          ],
          vendor_excel: ["xlsx", "jszip", "file-saver"],
        },
      },
    },
  },
})
