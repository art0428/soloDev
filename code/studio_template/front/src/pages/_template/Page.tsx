import { EmptyState } from '../../components/States'

/**
 * 空頁範本：步 1 每個選單項目先指到這裡。步 3 做切片時複製成 pages/<模組名>/<Name>Page.tsx，
 * 連同 Page.test.tsx 一起複製，那是「每個畫面一條掛載煙霧測試」的範本。
 */
export function Page({ title }: { title: string }) {
  return (
    <section>
      <div className="h1-row">
        <h1>{title}</h1>
      </div>
      <EmptyState title="這一頁還沒有內容。" hint="照原型做出來之後會換掉這段文字。" />
    </section>
  )
}
