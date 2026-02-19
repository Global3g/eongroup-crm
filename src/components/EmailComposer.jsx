import React, { useState, useEffect } from 'react';
import {
  Mail, Send, X, CheckCircle, AlertCircle, Loader, Globe
} from 'lucide-react';
import { PLANTILLAS_POR_ETAPA } from '../utils/communication';

// Configuración de EmailJS
const EMAILJS_CONFIG = {
  publicKey: 'MdW1DuU1IFKC9HL_q',
  serviceId: 'service_nfefxqn',
  templateId: 'template_augho41'
};

const EMAIL_TEMPLATES = [
  {
    id: 'seguimiento',
    name: 'Seguimiento',
    subject: 'Seguimiento a nuestra conversación',
    body: `Estimado/a {nombre},

Espero que se encuentre bien. Me pongo en contacto para dar seguimiento a nuestra conversación anterior.

Quedo atento a sus comentarios.

Saludos cordiales,
{remitente}`
  },
  {
    id: 'propuesta',
    name: 'Envío de Propuesta',
    subject: 'Propuesta comercial - {empresa}',
    body: `Estimado/a {nombre},

Es un placer contactarle. Adjunto encontrará nuestra propuesta comercial con los servicios que hemos preparado especialmente para {empresa}.

Quedamos a su disposición para cualquier duda o aclaración.

Saludos cordiales,
{remitente}`
  },
  {
    id: 'agradecimiento',
    name: 'Agradecimiento',
    subject: 'Gracias por su preferencia',
    body: `Estimado/a {nombre},

Queremos agradecerle por confiar en nosotros. Es un placer tenerle como cliente.

Si tiene alguna pregunta o necesita asistencia, no dude en contactarnos.

Saludos cordiales,
{remitente}`
  },
  {
    id: 'recordatorio',
    name: 'Recordatorio de Reunión',
    subject: 'Recordatorio: Reunión programada',
    body: `Estimado/a {nombre},

Le recordamos nuestra reunión programada. Por favor confirme su asistencia.

Quedamos atentos.

Saludos cordiales,
{remitente}`
  },
  {
    id: 'custom',
    name: 'Personalizado',
    subject: '',
    body: ''
  }
];

function EmailComposer({ isOpen, onClose, destinatario, currentUser, onEmailSent }) {
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('custom');

  useEffect(() => {
    if (destinatario) {
      setTo(destinatario.email || '');
      setToName(destinatario.contacto || destinatario.nombre || '');
    }
  }, [destinatario]);

  useEffect(() => {
    if (isOpen) {
      setSent(false);
      setError('');

      // Auto-suggest template if pipeline stage is available
      if (destinatario?.pipelineEtapa) {
        const suggestedTemplate = PLANTILLAS_POR_ETAPA[destinatario.pipelineEtapa];
        if (suggestedTemplate && suggestedTemplate !== 'custom') {
          applyTemplate(suggestedTemplate);
        }
      }
    }
  }, [isOpen]);

  const applyTemplate = (templateId) => {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      let subjectText = template.subject
        .replace('{empresa}', destinatario?.empresa || '')
        .replace('{nombre}', toName);
      let bodyText = template.body
        .replace(/{nombre}/g, toName || '[Nombre]')
        .replace(/{empresa}/g, destinatario?.empresa || '[Empresa]')
        .replace(/{remitente}/g, currentUser?.nombre || 'Tu nombre');
      setSubject(subjectText);
      setBody(bodyText);
    }
  };

  const sendEmail = async () => {
    if (!to || !subject || !body) {
      setError('Por favor completa todos los campos');
      return;
    }

    // Verificar si EmailJS está configurado
    if (EMAILJS_CONFIG.publicKey === 'TU_PUBLIC_KEY') {
      setError('EmailJS no está configurado. Por favor configura las credenciales en el código.');
      return;
    }

    setSending(true);
    setError('');

    try {
      // eslint-disable-next-line no-undef
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        {
          to_email: to,
          to_name: toName,
          from_name: 'NewcorpAI',
          subject: subject,
          message: body
        },
        EMAILJS_CONFIG.publicKey
      );

      setSent(true);
      if (onEmailSent) {
        onEmailSent({
          to,
          toName,
          subject,
          body,
          fecha: new Date().toISOString(),
          pipelineEtapa: destinatario?.pipelineEtapa || null
        });
      }

      // Cerrar después de 2 segundos
      setTimeout(() => {
        onClose();
        setTo('');
        setToName('');
        setSubject('');
        setBody('');
        setSent(false);
        setSelectedTemplate('custom');
      }, 2000);

    } catch (err) {
      console.error('Error enviando email:', err);
      setError('Error al enviar el correo. Verifica la configuración de EmailJS.');
    } finally {
      setSending(false);
    }
  };

  // Abrir en cliente de correo como alternativa
  const openInMailClient = () => {
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-cyan-500/10 to-violet-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Nuevo Correo</h3>
                <p className="text-xs text-slate-400">Envía un correo a tu cliente</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {sent ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">¡Correo Enviado!</h4>
              <p className="text-slate-400">El correo ha sido enviado exitosamente a {to}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Plantillas */}
            <div className="p-4 border-b border-slate-800">
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Plantillas</label>
              <div className="flex gap-2 flex-wrap">
                {EMAIL_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      selectedTemplate === template.id
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
              {destinatario?.pipelineEtapa && (
                <p className="text-xs text-cyan-400 mt-2">
                  💡 Plantilla sugerida para la etapa: {destinatario.pipelineEtapa}
                </p>
              )}
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Para</label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del correo"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Mensaje</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  rows="10"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 flex items-center justify-between">
              <button
                onClick={openInMailClient}
                className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                <Globe size={16} />
                Abrir en cliente de correo
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendEmail}
                  disabled={sending || !to || !subject || !body}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default EmailComposer;
