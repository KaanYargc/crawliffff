import BusinessFinder from "@/components/lead/business-finder";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-12 bg-gradient-to-b from-background to-muted">
      <div className="container max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            İşletme Arama Platformu
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Crawlify teknolojisi ile Türkiye'deki işletmeleri bulun,
            bilgilerini Excel veya PDF olarak dışa aktarın.
          </p>
        </div>

        <BusinessFinder />
      </div>

      <footer className="mt-12 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Crawlify. Tüm hakları saklıdır.
      </footer>
    </main>
  );
}
