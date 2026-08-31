export interface ProjectEntry {
  /** 绝对路径（唯一键，规范化） */
  path: string;
  /** 展示用文件夹名 */
  name: string;
  /** 用户备注名称 */
  note?: string;
  /** 置顶 */
  pinned?: boolean;
  /** 最近打开时间戳 */
  lastOpenedAt: number;
  /** 删除墓碑，防止再次读历史时复活 */
  removed?: boolean;
  /** 仅用于传给 webview 渲染：路径是否已不存在 */
  missing?: boolean;
  /** 文件夹内最新一次编辑时间（毫秒时间戳），由扩展计算后传入 */
  lastEditedAt?: number;
}

export const MAX_PROJECTS = 100;
