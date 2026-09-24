import { ruleBasedClassifier } from "@/lib/metadata/classifier";
import { classifySchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";

/**
 * POST /api/admin/classify { title, description?, url? }
 * Gợi ý metadata (môn, khối, chủ đề, loại, ngôn ngữ, độ khó, từ khóa). Chỉ là gợi ý – admin duyệt trước khi lưu.
 */
export const POST = handler(async (request: Request) => {
  await requireApiSession("admin");
  const input = classifySchema.parse(await readJson(request));
  return json(ruleBasedClassifier.classify(input));
});
