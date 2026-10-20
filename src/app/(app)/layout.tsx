import { AppHeader } from "@/components/app-header";

/**
 * Giriş yapılmış tüm sayfaların ortak çerçevesi. Menü burada olduğu için sayfa geçişlerinde
 * yeniden çizilmez; yeni sayfa yüklenirken `loading.tsx` iskeleti anında görünür.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
