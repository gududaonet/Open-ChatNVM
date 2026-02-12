// app/settings/page.tsx
// Settings Panel v1.0
// By Chenmou-GududaoStudio(Github-GududaoNet/Open-ChatNVM)
//https://github.com/gududaonet/open-chatnvm

"use client";

import { useCallback, useState } from "react";
import { db } from "@/lib/db";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import Footer from "@/components/footer";

export default function SettingsPage() {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showInvalidFormatDialog, setShowInvalidFormatDialog] = useState(false);
  const [showFinalConfirmDialog, setShowFinalConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<{ sessions: any[]; messages: any[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false); // <-- 新增

  // 生成安全的文件名（适配所有操作系统）
  const generateExportFilename = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `CF-AI-WEB-Backup-${y}${m}${d}-${h}${min}.json`;
  };

  // 导出数据
  const handleExport = useCallback(async () => {
    try {
      const sessions = await db.session.toArray();
      const messages = await db.message.toArray();

      const payload = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        database: "CF_AI_DB",
        sessions: sessions.map(s => ({ ...s, updatedAt: s.updatedAt.toISOString() })),
        messages: messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = generateExportFilename(); // 使用新命名规则
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("导出失败，请重试");
      console.error(err);
    }
  }, []);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const data = JSON.parse(result);

        const isValid =
          data &&
          Array.isArray(data.sessions) &&
          Array.isArray(data.messages) &&
          data.database === "CF_AI_DB";

        if (!isValid) {
          setImportFile(file);
          setShowInvalidFormatDialog(true);
          return;
        }

        // 格式有效 → 跳过第一次警告，直接进入最终确认
        setPendingData({ sessions: data.sessions, messages: data.messages });
        setShowFinalConfirmDialog(true);
      } catch (err) {
        alert("文件解析失败，请选择有效的 .json 备份文件");
      }
    };
    reader.readAsText(file);
  };

  // 执行导入（增量添加）
  const importData = async () => {
    if (!pendingData) return;

    setIsUploading(true);
    try {
      const { sessions, messages } = pendingData;
      await db.transaction("rw", db.session, db.message, async () => {
        if (sessions.length) {
          await db.session.bulkPut(
            sessions.map(s => ({
              ...s,
              updatedAt: new Date(s.updatedAt),
            }))
          );
        }
        if (messages.length) {
          await db.message.bulkPut(
            messages.map(m => ({
              ...m,
              createdAt: new Date(m.createdAt), // 确保字段名匹配你的类型
            }))
          );
        }
      });
      alert("数据已成功合并！");
    } catch (err) {
      console.error("导入失败:", err);
      alert("导入失败，请确保文件完整性");
    } finally {
      setIsUploading(false);
      setPendingData(null);
      setShowFinalConfirmDialog(false);
      setShowInvalidFormatDialog(false);
    }
  };

  // 用户在“格式无效”后仍要导入 进入最终确认
  const handleForceImport = () => {
    if (!importFile) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];
        const messages = Array.isArray(data.messages) ? data.messages : [];
        setPendingData({ sessions, messages });
        setShowInvalidFormatDialog(false);
        setShowFinalConfirmDialog(true); // 第二次确认
      } catch {
        alert("数据无效");
      }
    };
    reader.readAsText(importFile);
  };
    // --- 新增：清空数据函数 ---
  const handleClearAllData = async () => {
    setIsUploading(true); // 可以复用这个状态来禁用按钮
    try {
      await db.transaction("rw", db.session, db.message, async () => {
        await db.session.clear(); // 清空会话表
        await db.message.clear(); // 清空消息表
      });
      alert("所有数据已抹除");
      // 可选：清空后刷新页面或跳转到首页
       window.location.reload();
      // router.push("/"); // 需要引入 useRouter
    } catch (err) {
      console.error("清空数据失败:", err);
      alert("出现错误，请重试");
    } finally {
      setIsUploading(false);
      setShowClearConfirmDialog(false); // 关闭确认对话框
    }
  };
  // --- 结束新增 ---

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-6">
      <div className="w-full max-w-2xl space-y-6">
        <h1> </h1>
        <h1 className="text-2xl font-bold">控制面板</h1>

        {/* 数据备份部分 */}
        <div className="space-y-4">
          <h2>数据备份 (测试功能)</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleExport} className="flex-1" disabled={isUploading}>
              导出数据
            </Button>

            <div className="flex-1">
              <label className="block w-full">
                <span className="sr-only">选择 .json 备份文件</span>
                <input
                  type="file"
                  accept=".json,*/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
                  disabled={isUploading}
                >
                  导入数据
                </Button>
              </label>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            请使用CF-AI-WEB备份文件(.json)。导入增量更新当前数据。
          </p>
        </div>

        {/* 数据抹除部分 */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h2>数据抹除</h2>
          <Button
            onClick={() => setShowClearConfirmDialog(true)}
            variant="destructive"
            className="w-full"
            disabled={isUploading}
          >
            抹除所有数据
          </Button>
        </div>
          <p className="text-sm text-muted-foreground">
            控制面板 V1.0 By ChenMou <a href="https://github.com/gududaonet/open-chatnvm">Github</a>
          </p>
      </div>

      <Footer classname="mt-auto mb-4" />

      {/* 第一次确认：格式可能无效 */}
      <AlertDialog open={showInvalidFormatDialog} onOpenChange={setShowInvalidFormatDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>文件格式不标准</AlertDialogTitle>
            <AlertDialogDescription>
              此文件可能不是由该面板生成。继续操作可能导致数据异常或丢失。
              是否仍要尝试导入？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceImport} className="bg-yellow-600 hover:bg-yellow-700">
              继续
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 第二次确认：最终执行前 */}
      <AlertDialog open={showFinalConfirmDialog} onOpenChange={setShowFinalConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>合并聊天数据？</AlertDialogTitle>
            <AlertDialogDescription>
              即将把 {pendingData?.sessions.length || 0} 个会话和{" "}
              {pendingData?.messages.length || 0} 条消息增量合并到当前数据中。
              此操作不可逆，确定继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>再想想</AlertDialogCancel>
            <AlertDialogAction onClick={importData} className="bg-blue-600 hover:bg-blue-700">
              确认合并
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

            {/* --- 新增：清空数据确认对话框 --- */}
      <AlertDialog open={showClearConfirmDialog} onOpenChange={setShowClearConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除所有聊天会话和消息数据，<strong>无法挽回</strong>。
              确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploading}>取消</AlertDialogCancel> {/* 禁用按钮 */}
            <AlertDialogAction
              style={{ color: "white" }} // 修复：使用对象语法
              onClick={handleClearAllData}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // 确保样式一致
              disabled={isUploading} // 禁用按钮
            >
            确定清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* --- 结束新增 --- */}
    </div>
  );
}