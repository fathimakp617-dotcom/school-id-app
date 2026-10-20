import { useEffect, useState } from 'react'
import { Download, FileText, X } from 'lucide-react'
import { resolveHomeworkAsset } from '../data/homeworkStore'
import { API_URL } from '../data/apiConfig'

export default function HomeworkDetailsModal({ homework, onClose }) {
  const [attachmentObjectUrl, setAttachmentObjectUrl] = useState('')
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const attachment = homework?.attachment || (homework?.fileURL && homework.fileURL !== '#' ? { url: homework.fileURL, name: 'Homework attachment', type: homework.type === 'pdf' ? 'application/pdf' : '' } : null)
  const attachmentUrl = attachment?.url ? resolveHomeworkAsset(attachment.url) : null
  const isProtectedAttachment = Boolean(attachmentUrl && new URL(attachmentUrl, window.location.href).pathname.startsWith('/api/attachments/'))

  useEffect(() => {
    setAttachmentObjectUrl('')
    if (!attachmentUrl) return
    const apiOrigin = new URL(API_URL || window.location.origin, window.location.href).origin
    const fileOrigin = new URL(attachmentUrl, window.location.href).origin
    // Browser iframe/image requests cannot add our bearer token. Fetch protected files
    // through the app's authenticated fetch wrapper and render the resulting blob URL.
    if (fileOrigin !== apiOrigin || !isProtectedAttachment) return
    let active = true
    let objectUrl = ''
    fetch(attachmentUrl)
      .then(response => response.ok ? response.blob() : Promise.reject(new Error('Attachment could not be loaded.')))
      .then(blob => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setAttachmentObjectUrl(objectUrl)
      })
      .catch(() => { if (active) setAttachmentObjectUrl('') })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachmentUrl, isProtectedAttachment])

  if (!homework) return null
  const renderedAttachmentUrl = isProtectedAttachment ? attachmentObjectUrl : attachmentUrl
  const isPdf = attachment && (attachment.type === 'application/pdf' || attachment.name?.toLowerCase().endsWith('.pdf'))
  const isImage = attachment?.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(attachment?.name || '')

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="homework-detail-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
        <div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><span className="badge bg-blue-100 text-blue-700">{homework.subject}</span><span className="badge bg-gray-100 text-gray-600">Class {homework.class}</span></div><h2 id="homework-detail-title" className="text-xl font-bold text-gray-900 sm:text-2xl">{homework.title}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close homework details" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5"/></button>
      </header>
      <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-gray-500">Teacher</p><p className="mt-1 font-medium text-gray-800">{homework.teacherName || '—'}</p></div><div><p className="text-xs text-gray-500">Due date</p><p className="mt-1 font-medium text-gray-800">{homework.dueDate || '—'}</p></div><div><p className="text-xs text-gray-500">Posted</p><p className="mt-1 font-medium text-gray-800">{homework.uploadedAt ? new Date(homework.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p></div></div>
        <div><h3 className="mb-2 font-semibold text-gray-900">Instructions</h3><p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">{homework.description || 'No additional instructions.'}</p></div>
        <div><h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-900"><FileText className="h-4 w-4 text-blue-600"/>Attachment</h3>
          {attachmentUrl && !renderedAttachmentUrl && <p role="status" className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Loading attachment…</p>}
          {renderedAttachmentUrl && isPdf && <div className="overflow-hidden rounded-xl border border-gray-200"><iframe title={`${homework.title} attachment`} src={renderedAttachmentUrl} className="h-[55vh] min-h-80 w-full"/></div>}
          {renderedAttachmentUrl && isImage && <img src={renderedAttachmentUrl} alt={`${homework.title} attachment`} className="max-h-[55vh] w-full rounded-xl border border-gray-200 object-contain"/>}
          {renderedAttachmentUrl && !isPdf && !isImage && <a href={renderedAttachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-sm font-medium text-blue-700 hover:bg-blue-50"><FileText className="h-5 w-5"/><span className="flex-1">{attachment.name || 'Open attachment'}</span><Download className="h-4 w-4"/></a>}
          {!attachmentUrl && homework.type === 'pdf' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This sample assignment lists a PDF, but its file wasn’t included. New PDFs uploaded by the teacher will preview here.</p>}
          {!attachmentUrl && homework.type !== 'pdf' && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No attachment was added to this assignment.</p>}
        </div>
      </div>
    </section>
  </div>
}
