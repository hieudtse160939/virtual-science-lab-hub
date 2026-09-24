import SiteLayout from "./(site)/layout";
import SiteNotFound from "./(site)/not-found";

/** 404 cho mọi URL không khớp route nào – vẫn giữ header/footer. */
export default function NotFound() {
  return (
    <SiteLayout>
      <SiteNotFound />
    </SiteLayout>
  );
}
