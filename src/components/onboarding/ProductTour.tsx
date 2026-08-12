import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface ProductTourProps {
  run: number;
  onFinished: () => void;
}

export function ProductTour({ run, onFinished }: ProductTourProps) {
  useEffect(() => {
    if (run === 0) return;
    let finished = false;
    const tour = driver({
      animate: true,
      allowClose: true,
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Siguiente",
      prevBtnText: "Atrás",
      doneBtnText: "Terminar",
      popoverClass: "innoapp-tour-popover",
      steps: [
        { element: '[data-tour="view-data"]', popover: { title: "Tu espacio de datos", description: "Aquí viven tus KPIs y gráficas. Puedes moverlos y adaptarlos a tu negocio.", side: "bottom", align: "center" } },
        { element: '[data-tour="create-widget"]', popover: { title: "Crea indicadores", description: "Añade métricas y visualizaciones nuevas cuando necesites otra perspectiva.", side: "left", align: "end" } },
        { element: '[data-tour="view-agents"]', popover: { title: "Agentes conectados", description: "Instala equipos adicionales, consulta su estado y revisa los registros recibidos.", side: "bottom", align: "center" } },
        { element: '[data-tour="user-menu"]', popover: { title: "Ayuda siempre disponible", description: "Desde tu menú puedes volver a abrir esta guía cuando quieras.", side: "bottom", align: "end" } },
      ],
      onDestroyed: () => {
        if (!finished) {
          finished = true;
          onFinished();
        }
      },
    });
    const timer = window.setTimeout(() => tour.drive(), 150);
    return () => {
      window.clearTimeout(timer);
      finished = true;
      tour.destroy();
    };
  }, [run, onFinished]);
  return null;
}
