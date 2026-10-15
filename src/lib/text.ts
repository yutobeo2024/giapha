/** Chữ thường, bỏ dấu tiếng Việt (đ → d) để tìm kiếm không cần gõ dấu: "Quynh" khớp "Quỳnh" */
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}
