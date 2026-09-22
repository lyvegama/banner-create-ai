"use client";

import { FormEvent, useRef, useState } from "react";
import Image from "next/image";

type Attachment = {
  file: File;
  preview?: string;
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
};

const starterMessage: Message = {
  id: 1,
  role: "assistant",
  content:
    "Hola. Soy el asistente de Banner AI. Puedes preguntarme cualquier cosa y adjuntar imágenes o archivos para que los analice contigo.",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([starterMessage]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;

    const nextFiles = Array.from(files)
      .filter((file) => file.size <= 10 * 1024 * 1024)
      .map((file) => ({
        file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      }));

    setAttachments((current) => [...current, ...nextFiles]);
    if (nextFiles.length < files.length) {
      setError("Cada archivo debe pesar menos de 10 MB.");
    }
  }

  function removeAttachment(index: number) {
    const attachment = attachments[index];
    if (attachment.preview) URL.revokeObjectURL(attachment.preview);
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!draft.trim() && attachments.length === 0) || isSending) return;

    const userMessage = draft.trim();
    const sentAttachments = attachments.map(({ file }) => file.name);
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", content: userMessage, attachments: sentAttachments },
    ]);
    setDraft("");
    setAttachments([]);
    setError("");
    setIsSending(true);

    const formData = new FormData();
    formData.append("message", userMessage);
    formData.append(
      "history",
      JSON.stringify(messages.map(({ role, content }) => ({ role, content }))),
    );
    attachments.forEach(({ file }) => formData.append("files", file));

    try {
      const response = await fetch("/api/chat", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo obtener una respuesta.");

      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: result.message },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ha ocurrido un error.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">B</div>
        <div>
          <p className="eyebrow">Workspace privado</p>
          <h1>Banner AI</h1>
        </div>
        <div className="sidebar-rule" />
        <button className="new-chat" onClick={() => setMessages([starterMessage])}>
          <span>+</span> Nueva conversación
        </button>
        <div className="side-note">
          <span className="status-dot" />
          <div>
            <strong>Asistente conectado</strong>
            <p>Texto, imágenes y documentos</p>
          </div>
        </div>
        <p className="sidebar-footer">FASE 01 / CONVERSACIÓN</p>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Canal interno · ahora</p>
          </div>
          <div className="header-badge"><span className="status-dot" /> En línea</div>
        </header>

        <div className="message-list">
          <div className="date-divider"><span>Hoy</span></div>
          {messages.map((message) => (
            <article className={`message-row ${message.role}`} key={message.id}>
              {message.role === "assistant" && <div className="avatar">B</div>}
              <div className="message-body">
                <div className="message-meta">
                  <strong>{message.role === "assistant" ? "Banner AI" : "Tú"}</strong>
                  <span>{message.role === "assistant" ? "Asistente" : "Ahora"}</span>
                </div>
                <div className="message-bubble">{message.content || "Archivo adjunto"}</div>
                {message.attachments?.length ? (
                  <div className="sent-files">
                    {message.attachments.map((name) => <span key={name}>↗ {name}</span>)}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          {isSending && (
            <article className="message-row assistant">
              <div className="avatar">B</div>
              <div className="message-body">
                <div className="message-meta"><strong>Banner AI</strong><span>Escribiendo</span></div>
                <div className="message-bubble typing"><i /><i /><i /></div>
              </div>
            </article>
          )}
        </div>

        <div className="composer-wrap">
          {attachments.length > 0 && (
            <div className="attachment-strip">
              {attachments.map((attachment, index) => (
                <div className="attachment" key={`${attachment.file.name}-${index}`}>
                  {attachment.preview ? <Image src={attachment.preview} alt="" width={30} height={30} unoptimized /> : <span className="file-icon">DOC</span>}
                  <span>{attachment.file.name}</span>
                  <button type="button" onClick={() => removeAttachment(index)} aria-label={`Eliminar ${attachment.file.name}`}>×</button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
          <form className="composer" onSubmit={sendMessage}>
            <button type="button" className="icon-button" onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar archivos">＋</button>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.json,.csv" onChange={(event) => addFiles(event.target.files)} hidden />
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe un mensaje..." aria-label="Mensaje" />
            <span className="composer-hint">⌘ ↵</span>
            <button className="send-button" type="submit" disabled={isSending || (!draft.trim() && attachments.length === 0)} aria-label="Enviar mensaje">↑</button>
          </form>
          <p className="privacy-note">La conversación pertenece al workspace interno de la empresa.</p>
        </div>
      </section>
    </main>
  );
}
