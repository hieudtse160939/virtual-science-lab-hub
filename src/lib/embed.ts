/**
 * Chỉ nhúng iframe khi có embed_url VÀ nguồn cho phép nhúng
 * (bản ghi không có nguồn: embed_url do admin nhập = đã xác nhận quyền nhúng).
 */
export function isEmbeddable(sim: { embed_url: string | null; source: { allows_embed: boolean } | null }) {
  return !!sim.embed_url && (sim.source ? sim.source.allows_embed : true);
}
