import React, { useState } from 'react';
import {
  BarChart3, UserPlus, GitBranch, Building, Target, MessageCircle,
  ChevronRight, X
} from 'lucide-react';

const TOUR_STEPS = [
  {
    title: 'Dashboard',
    description: 'Aqui ves tus KPIs, tareas pendientes y alertas automaticas',
    icon: BarChart3,
    color: 'from-cyan-500 to-blue-500',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400'
  },
  {
    title: 'Leads',
    description: 'Captura y califica prospectos con inteligencia artificial',
    icon: UserPlus,
    color: 'from-violet-500 to-purple-500',
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400'
  },
  {
    title: 'Pipeline',
    description: 'Arrastra y mueve negocios entre etapas de venta',
    icon: GitBranch,
    color: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400'
  },
  {
    title: 'Cuentas',
    description: 'Gestiona tus clientes activos y su historial',
    icon: Building,
    color: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400'
  },
  {
    title: 'Tareas',
    description: 'Organiza tu trabajo con tareas recurrentes y calendario',
    icon: Target,
    color: 'from-pink-500 to-rose-500',
    iconBg: 'bg-pink-500/20',
    iconColor: 'text-pink-400'
  },
  {
    title: 'Chatbot IA',
    description: 'Tu asistente inteligente con acceso a toda la data',
    icon: MessageCircle,
    color: 'from-blue-500 to-indigo-500',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400'
  }
];

function OnboardingTour({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const totalSteps = TOUR_STEPS.length;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    setCurrentStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleFinish} />

      {/* Card */}
      <div className="relative bg-slate-900/95 backdrop-blur-xl border border-slate-300/40 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleFinish}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Step indicator */}
        <div className="text-center mb-6">
          <span className="text-xs font-medium text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-20 h-20 rounded-2xl ${step.iconBg} flex items-center justify-center`}>
            <Icon size={40} className={step.iconColor} />
          </div>
        </div>

        {/* Title and description */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-white mb-3">{step.title}</h3>
          <p className="text-slate-400 text-base leading-relaxed">{step.description}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleFinish}
            className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-medium hover:bg-slate-700 hover:text-white transition-all"
          >
            Omitir
          </button>
          <button
            onClick={handleNext}
            className={`flex-1 py-3 bg-gradient-to-r ${step.color} text-white rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2`}
          >
            {currentStep < totalSteps - 1 ? (
              <>
                Siguiente
                <ChevronRight size={18} />
              </>
            ) : (
              'Comenzar'
            )}
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
          {TOUR_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentStep
                  ? 'bg-cyan-400 w-6'
                  : i < currentStep
                  ? 'bg-cyan-400/50'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default OnboardingTour;
