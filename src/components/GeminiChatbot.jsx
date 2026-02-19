import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Sparkles, Send, Copy, RotateCcw, Maximize2, Minimize2,
  Loader, X
} from 'lucide-react';
import { getFechaLocal } from '../utils/helpers';

function renderMarkdown(text) {
  if (!text) return null;

  // Dividir el texto en líneas para procesar mejor
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    const elements = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      // Buscar imagen: ![alt](url) - DEBE ir primero
      const imgMatch = remaining.match(/^(.*?)!\[([^\]]*)\]\(([^)]+)\)(.*)$/);
      if (imgMatch) {
        // Texto antes de la imagen
        if (imgMatch[1]) {
          elements.push(<span key={key++}>{imgMatch[1]}</span>);
        }
        // La imagen con fallback a link
        const imgUrl = imgMatch[3];
        const imgAlt = imgMatch[2] || 'Imagen';
        const imgKey = key++;
        elements.push(
          <span key={imgKey} className="block my-2">
            <img
              src={imgUrl}
              alt={imgAlt}
              className="max-w-full h-auto rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90"
              onClick={() => window.open(imgUrl, '_blank')}
              onError={(e) => {
                // Reemplazar imagen rota con un link
                const parent = e.target.parentNode;
                const link = document.createElement('a');
                link.href = imgUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'flex items-center gap-2 text-cyan-400 hover:text-cyan-300 underline bg-slate-700/50 px-3 py-2 rounded-lg';
                link.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Ver imagen: ${imgAlt}`;
                parent.replaceChild(link, e.target);
              }}
            />
          </span>
        );
        remaining = imgMatch[4] || '';
        continue;
      }

      // Buscar link: [text](url) - pero no si empieza con !
      const linkMatch = remaining.match(/^(.*?)(?<!!)\[([^\]]+)\]\(([^)]+)\)(.*)$/);
      if (linkMatch) {
        if (linkMatch[1]) {
          elements.push(<span key={key++}>{linkMatch[1]}</span>);
        }
        elements.push(
          <a
            key={key++}
            href={linkMatch[3]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            {linkMatch[2]}
          </a>
        );
        remaining = linkMatch[4] || '';
        continue;
      }

      // Buscar negrita: **text**
      const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
      if (boldMatch) {
        if (boldMatch[1]) {
          elements.push(<span key={key++}>{boldMatch[1]}</span>);
        }
        elements.push(<strong key={key++}>{boldMatch[2]}</strong>);
        remaining = boldMatch[3] || '';
        continue;
      }

      // No hay más matches, agregar el resto como texto
      elements.push(<span key={key++}>{remaining}</span>);
      break;
    }

    // Agregar salto de línea entre líneas (excepto la última)
    if (lineIndex < lines.length - 1) {
      elements.push(<br key={`br-${lineIndex}`} />);
    }

    return <span key={`line-${lineIndex}`}>{elements}</span>;
  });
}

function GeminiChatbot({ clientes, pipeline, actividades, tareas, recordatorios, currentUser, externalOpen, onExternalOpenHandled }) {
  const [isOpen, setIsOpen] = useState(false);

  // Allow external trigger to open chatbot
  useEffect(() => {
    if (externalOpen) {
      setIsOpen(true);
      if (onExternalOpenHandled) onExternalOpenHandled();
    }
  }, [externalOpen, onExternalOpenHandled]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de CRM powered by AI. Puedo ayudarte a:\n\n• Consultar información de tu CRM\n• Ver tareas y recordatorios pendientes\n• Redactar actividades y correos profesionales\n• Analizar datos de clientes y prospectos\n\n¿En qué puedo ayudarte?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Crear contexto del CRM para el asistente
  const getCRMContext = () => {
    const hoy = getFechaLocal();
    const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Formatear fecha legible
    const formatFecha = (fecha) => {
      if (!fecha) return 'sin fecha';
      if (fecha === hoy) return 'hoy';
      if (fecha === manana) return 'mañana';
      const [y, m, d] = fecha.split('-');
      return `${d}/${m}/${y}`;
    };

    // Clientes (máx 10)
    const listaClientes = (clientes || []).slice(0, 10).map(c =>
      `• ${c.empresa || c.nombre} (${c.contacto || 'sin contacto'})`
    ).join('\n') || 'No hay clientes';

    // Prospectos (máx 10)
    const listaProspectos = (pipeline || []).slice(0, 10).map(p =>
      `• ${p.empresa || p.nombre} - Etapa: ${p.etapa} - Valor: $${p.valorEstimado || 0}`
    ).join('\n') || 'No hay prospectos';

    // Recordatorios pendientes con detalles
    const recordatoriosPendientesLista = (recordatorios || [])
      .filter(r => !r.completado)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .slice(0, 10)
      .map(r => {
        const cliente = (clientes || []).find(c => c.id === r.clienteId);
        const prospecto = (pipeline || []).find(p => p.id === r.pipelineId);
        const entidad = cliente?.empresa || cliente?.nombre || prospecto?.empresa || prospecto?.nombre || '';
        return `• "${r.titulo}" - Fecha: ${formatFecha(r.fecha)}${entidad ? ` - Para: ${entidad}` : ''}`;
      }).join('\n') || 'No hay recordatorios pendientes';

    // Tareas pendientes con detalles
    const tareasPendientesLista = (tareas || [])
      .filter(t => !t.completada)
      .sort((a, b) => new Date(a.fechaCompromiso) - new Date(b.fechaCompromiso))
      .slice(0, 10)
      .map(t => {
        const cliente = (clientes || []).find(c => c.id === t.clienteId);
        const prospecto = (pipeline || []).find(p => p.id === t.pipelineId);
        const entidad = cliente?.empresa || cliente?.nombre || prospecto?.empresa || prospecto?.nombre || '';
        return `• "${t.descripcion}" - Fecha compromiso: ${formatFecha(t.fechaCompromiso)} - Prioridad: ${t.prioridad}${entidad ? ` - Para: ${entidad}` : ''}`;
      }).join('\n') || 'No hay tareas pendientes';

    // Actividades recientes
    const actividadesRecientes = (actividades || [])
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
      .slice(0, 5)
      .map(a => `• ${a.tipo}: ${a.titulo || a.descripcion} (${formatFecha(a.fecha)})`
      ).join('\n') || 'No hay actividades recientes';

    return `CONTEXTO COMPLETO DEL CRM - Fecha actual: ${formatFecha(hoy)}
Usuario: ${currentUser?.nombre || 'Usuario'}

📊 RESUMEN:
- Total clientes: ${(clientes || []).length}
- Total prospectos: ${(pipeline || []).length}
- Tareas pendientes: ${(tareas || []).filter(t => !t.completada).length}
- Recordatorios pendientes: ${(recordatorios || []).filter(r => !r.completado).length}

🔔 RECORDATORIOS PENDIENTES:
${recordatoriosPendientesLista}

✅ TAREAS PENDIENTES:
${tareasPendientesLista}

👥 CLIENTES:
${listaClientes}

💼 PROSPECTOS EN PIPELINE:
${listaProspectos}

📝 ACTIVIDADES RECIENTES:
${actividadesRecientes}`;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const crmContext = getCRMContext();
      const systemPrompt = `Eres un asistente de CRM profesional y amigable para Grupo EÖN CRM. ${crmContext}

Instrucciones:
- Responde siempre en español
- Sé conciso pero útil
- Si te piden redactar algo (actividad, correo, nota), proporciona un texto bien estructurado y profesional
- Si te preguntan sobre datos del CRM, usa el contexto proporcionado
- Para correos, incluye saludo, cuerpo y despedida profesional
- Para actividades, incluye un título claro y descripción detallada
- Usa **negritas** para resaltar información importante`;

      // Historial: últimos 20 mensajes (formato OpenAI)
      const historial = updatedMessages.slice(-20).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historial, systemPrompt })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error de API:', data);
        throw new Error(data.error?.message || `Error ${response.status}`);
      }

      if (data.choices && data.choices[0]?.message?.content) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.choices[0].message.content
        }]);
      } else {
        throw new Error('Respuesta inválida');
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const quickActions = [
    { label: 'Info completa CRM', prompt: 'Dame un resumen completo de toda la información de mi CRM: clientes, prospectos, tareas pendientes, recordatorios y actividades recientes. Incluye fechas y detalles importantes.' },
    { label: 'Mis pendientes', prompt: 'Dame una lista detallada de todas mis tareas y recordatorios pendientes con sus fechas. ¿Cuáles son para hoy y cuáles para mañana?' },
    { label: 'Redactar actividad', prompt: 'Ayúdame a redactar una actividad profesional para registrar una llamada de seguimiento con un cliente' },
    { label: 'Escribir correo', prompt: 'Ayúdame a escribir un correo profesional para dar seguimiento a un prospecto interesado en nuestros servicios' },
    { label: 'Nota de reunión', prompt: 'Ayúdame a redactar una nota de reunión profesional para registrar los puntos discutidos con un cliente' }
  ];

  const clearChat = () => {
    setMessages([
      { role: 'assistant', content: '¡Hola! Soy tu asistente de CRM powered by AI. Puedo consultar tu CRM, redactar correos y actividades, y ayudarte con tus datos. ¿En qué puedo ayudarte?' }
    ]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50 group"
      >
        <Bot className="w-7 h-7 text-white" />
        <span className="absolute -top-10 right-0 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700">
          Asistente AI
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed ${isExpanded ? 'inset-4' : 'bottom-6 right-6 w-96 h-[600px]'} bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 flex flex-col z-50 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Asistente CRM</h3>
            <p className="text-xs text-slate-400">Powered by AI</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="Limpiar chat">
            <RotateCcw size={18} />
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title={isExpanded ? 'Minimizar' : 'Expandir'}>
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="Cerrar">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-slate-800 flex gap-2 overflow-x-auto scrollbar-thin">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => { setInput(action.prompt); }}
            className="flex-shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-all whitespace-nowrap"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-violet-500/20 border-violet-500/30' : 'bg-slate-800 border-slate-700'} border rounded-2xl p-3`}>
              <div className="text-white text-sm whitespace-pre-wrap">{renderMarkdown(msg.content)}</div>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyToClipboard(msg.content)}
                  className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                >
                  <Copy size={12} /> Copiar
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="text-slate-400 text-sm">Pensando...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500 transition-colors"
              rows="1"
              style={{ maxHeight: '120px', minHeight: '44px' }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default GeminiChatbot;
