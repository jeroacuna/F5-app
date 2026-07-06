/* =========================================================
   LA REDONDA F5 — lógica de reservas
   ========================================================= */
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const WHATSAPP_NUMERO = '';

(() => {
  'use strict';

  /* ---------- datos de las canchas ---------- */
/* ---------- datos de las canchas ---------- */
  const CANCHAS = {
    cancha1: { nombre: 'Cancha 1 (Fútbol/Hockey)', duracion: 60, precio: 25000 },
    cancha2: { nombre: 'Cancha 2 (Fútbol/Hockey)', duracion: 60, precio: 25000 },
    cancha3: { nombre: 'Cancha 3 (Fútbol/Hockey)', duracion: 60, precio: 25000 },
  };

  let turnosOcupadosDelDia = [];

  /* ---------- cliente de supabase ---------- */
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ---------- estado de la selección actual ---------- */
  const state = {
    tipo: null,
    fecha: null,
    slotStart: null, 
  };

  /* ---------- funciones de ayuda y lógica de tiempo ---------- */
  async function buscarReservasEnBaseDeDatos(fecha) {
    const { data, error } = await supabase
      .from('reservas')
      .select('slotStart, tipo')
      .eq('fecha', fecha);

    if (error) {
      console.error("Error trayendo reservas:", error);
      return [];
    }
    return data;
  }

  function slotOcupado(tipo, fecha, slotStart) {
    return turnosOcupadosDelDia.some(r => r.tipo === tipo && Number(r.slotStart) === Number(slotStart));
  }

  function getVentana(diaSemana) {
    const esFinde = diaSemana === 5 || diaSemana === 6; // 5 = viernes, 6 = sábado
    return esFinde
      ? { inicio: 14 * 60, fin: 25 * 60 }   // 14:00 a 01:00
      : { inicio: 10 * 60, fin: 23 * 60 };  // 10:00 a 23:00
  }

  function parseFechaLocal(fechaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function generarSlots(fechaStr, duracionMin) {
    const date = parseFechaLocal(fechaStr);
    const { inicio, fin } = getVentana(date.getDay());
    const slots = [];
    for (let s = inicio; s + duracionMin <= fin; s += duracionMin) {
      slots.push(s);
    }
    return slots;
  }

  function formatHora(min) {
    const totalMin = ((min % 1440) + 1440) % 1440;
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function formatRango(startMin, duracionMin) {
    return `${formatHora(startMin)} - ${formatHora(startMin + duracionMin)}`;
  }

  function formatFechaLarga(fechaStr) {
    const date = parseFechaLocal(fechaStr);
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function formatPrecio(num) {
    return `$${num.toLocaleString('es-AR')}`;
  }

  /* ============ referencias al DOM ============ */
  const tipoGrid       = document.getElementById('tipoGrid');
  const fechasLista    = document.getElementById('fechasLista');
  const diaHint         = document.getElementById('diaHint');
  const scoreboard       = document.getElementById('scoreboard');
  const reservaForm      = document.getElementById('reservaForm');
  const nombreInput      = document.getElementById('nombreInput');
  const telefonoInput    = document.getElementById('telefonoInput');
  const emailInput       = document.getElementById('emailInput');
  const confirmarBtn     = document.getElementById('confirmarBtn');
  const resumenTipo      = document.getElementById('resumenTipo');
  const resumenFecha     = document.getElementById('resumenFecha');
  const resumenHora      = document.getElementById('resumenHora');
  const resumenPrecio    = document.getElementById('resumenPrecio');
  const modal            = document.getElementById('modalConfirm');
  const modalText        = document.getElementById('modalText');
  const modalClose       = document.getElementById('modalClose');
  const modalWhatsapp    = document.getElementById('modalWhatsapp');

  /* ============ paso 1: elegir tipo de cancha ============ */
  function seleccionarTipo(tipo) {
    state.tipo = tipo;
    state.slotStart = null;

    tipoGrid.querySelectorAll('.tipo-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tipo === tipo);
    });

    const info = CANCHAS[tipo];
    diaHint.classList.remove('is-error');
    diaHint.textContent = `${info.nombre} — turnos de ${info.duracion} min. Dom a jue 10:00-23:00, vie y sáb 14:00-01:00.`;

    if (state.fecha) {
      renderScoreboard();
    } else {
      diaHint.textContent = "Excelente. Ahora seleccioná un día del carrusel de abajo.";
    }
    actualizarResumen();
  }

  tipoGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.tipo-btn');
    if (!btn) return;
    seleccionarTipo(btn.dataset.tipo);
  });

  document.querySelectorAll('[data-tipo-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      seleccionarTipo(btn.dataset.tipoSelect);
      document.getElementById('reserva').scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ============ paso 2: elegir fecha (CARRUSEL) ============ */
  function renderCarrusel() {
    if (!fechasLista) return;
    fechasLista.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
      let d = new Date();
      d.setDate(d.getDate() + i);
      const fechaStr = d.toISOString().split('T')[0];
      
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `fecha-item ${state.fecha === fechaStr ? 'is-selected' : ''}`;
      btn.innerHTML = `<small>${d.toLocaleDateString('es-AR', {weekday:'short'})}</small><strong>${d.getDate()}</strong>`;
      
      btn.onclick = async () => {
        if (!state.tipo) {
          alert('Primero seleccioná un tipo de cancha en el Paso 1.');
          return;
        }
        state.fecha = fechaStr;
        state.slotStart = null;
        
        renderCarrusel();
        
        diaHint.classList.remove('is-error');
        diaHint.textContent = 'Cargando disponibilidad...';
        scoreboard.innerHTML = '<p class="scoreboard__empty">Conectando con la base de datos...</p>';

        turnosOcupadosDelDia = await buscarReservasEnBaseDeDatos(state.fecha);

        const date = parseFechaLocal(state.fecha);
        const esFinde = date.getDay() === 5 || date.getDay() === 6;
        diaHint.textContent = esFinde
          ? `${formatFechaLarga(state.fecha)} — horario extendido 14:00 a 01:00.`
          : `${formatFechaLarga(state.fecha)} — horario 10:00 a 23:00.`;

        renderScoreboard();
        actualizarResumen();
      };
      
      fechasLista.appendChild(btn);
    }
  }

  /* ============ paso 3: scoreboard de horarios ============ */
  function renderScoreboard() {
    if (!scoreboard) return;
    scoreboard.innerHTML = '';

    if (!state.tipo || !state.fecha) {
      scoreboard.innerHTML = '<p class="scoreboard__empty">Seleccioná cancha y fecha para ver los turnos disponibles</p>';
      return;
    }

    const info = CANCHAS[state.tipo];
    const slots = generarSlots(state.fecha, info.duracion);

    slots.forEach(slotStart => {
      const ocupado = slotOcupado(state.tipo, state.fecha, slotStart);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = formatRango(slotStart, info.duracion);
      btn.disabled = ocupado;
      
      if (slotStart === state.slotStart) btn.classList.add('is-selected');

      btn.addEventListener('click', () => {
        state.slotStart = slotStart;
        scoreboard.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        actualizarResumen();
      });

      scoreboard.appendChild(btn);
    });
  }

  /* ============ actualizar resumen y botón ============ */
  function actualizarResumen() {
    if (state.tipo) {
      resumenTipo.textContent = CANCHAS[state.tipo].nombre;
      resumenPrecio.textContent = formatPrecio(CANCHAS[state.tipo].precio);
    } else {
      resumenTipo.textContent = '—';
      resumenPrecio.textContent = '—';
    }

    if (state.fecha) {
      resumenFecha.textContent = formatFechaLarga(state.fecha);
    } else {
      resumenFecha.textContent = '—';
    }

    if (state.tipo && state.slotStart !== null) {
      resumenHora.textContent = formatRango(state.slotStart, CANCHAS[state.tipo].duracion);
      confirmarBtn.disabled = false;
    } else {
      resumenHora.textContent = '—';
      confirmarBtn.disabled = true;
    }
  }

  /* ============ paso 4: envío de formulario ============ */
  reservaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!state.tipo || !state.fecha || !state.slotStart) {
      alert('Faltan seleccionar datos del turno.');
      return;
    }

    const nombre = nombreInput.value.trim();
    const telefono = telefonoInput.value.trim();
    const email = emailInput.value.trim(); 

    if (!nombre || !telefono) {
      alert('Por favor, completa todos los campos obligatorios.');
      return;
    }

    const btnSubmit = reservaForm.querySelector('button[type="submit"]');
    const textoOriginal = btnSubmit.textContent;
    btnSubmit.textContent = 'Guardando reserva...';
    btnSubmit.disabled = true;

    const nuevaReserva = {
      tipo: state.tipo,
      fecha: state.fecha,
      slotStart: state.slotStart,
      nombre: nombre,
      telefono: telefono,
      email: email 
    };

    const { data, error } = await supabase
      .from('reservas')
      .insert([nuevaReserva]);

    if (error) {
      console.error("Error al guardar la reserva:", error);
      alert('Hubo un problema al registrar tu turno. Intentá de nuevo.');
      btnSubmit.textContent = textoOriginal;
      btnSubmit.disabled = false;
      return;
    }

    turnosOcupadosDelDia.push(nuevaReserva);
    renderScoreboard();

    const info = CANCHAS[state.tipo];
    const rango = formatRango(state.slotStart, info.duracion);
    const fechaLarga = formatFechaLarga(state.fecha);

    modalText.innerHTML = `Tu turno de <strong>${info.nombre}</strong> para el día <strong>${fechaLarga}</strong> a las <strong>${rango} hs</strong> fue registrado con éxito.<br><br>📧 Te enviamos un correo electrónico de confirmación de forma automática.`;
    
    modalWhatsapp.textContent = 'Entendido / Cerrar';
    modalWhatsapp.onclick = () => {
      cerrarModal();
      reservaForm.reset();
      state.slotStart = null;
      actualizarResumen();
    };

    modal.classList.add('is-open');

    btnSubmit.textContent = textoOriginal;
    btnSubmit.disabled = false;
  });

  /* ============ modal de confirmación ============ */
  function cerrarModal() {
    modal.classList.remove('is-open');
  }

  modalClose.addEventListener('click', cerrarModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

  /* ============ menú mobile ============ */
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');

  hamburger.addEventListener('click', () => {
    const abierto = nav.classList.toggle('is-open');
    hamburger.classList.toggle('is-open', abierto);
    hamburger.setAttribute('aria-expanded', String(abierto));
  });

  nav.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  /* ============ varios ============ */
  document.getElementById('anioActual').textContent = new Date().getFullYear();

  // Inicialización de elementos
  renderCarrusel();
  renderScoreboard();
})();