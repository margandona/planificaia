/**
 * Script de ingesta curricular desde curriculumnacional.cl
 * 
 * Uso: pnpm run ingesta
 * 
 * Este script obtiene los OA, habilidades y actitudes
 * desde el portal oficial del Ministerio de Educación
 * y los almacena en Firestore.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Datos curriculares de Historia 5° a 8° básico
// Obtenidos del portal Currículum Nacional (curriculumnacional.cl)
// Fecha de consulta: 2026-07-30
function makeSkills() {
  return [
    { code: 'OAH a', text: 'Interpretar periodizaciones históricas mediante líneas de tiempo, reconociendo la duración, la sucesión y la simultaneidad de acontecimientos o procesos históricos.' },
    { code: 'OAH b', text: 'Analizar elementos de continuidad y cambio entre periodos y procesos abordados en el nivel.' },
    { code: 'OAH c', text: 'Representar la ubicación y características de los lugares mediante la construcción de mapas a diferentes escalas.' },
    { code: 'OAH d', text: 'Interpretar datos e información geográfica utilizando tecnología apropiada.' },
    { code: 'OAH e', text: 'Seleccionar fuentes de información considerando la confiabilidad de la fuente.' },
    { code: 'OAH f', text: 'Analizar y comparar información obtenida de diversas fuentes para utilizarla como evidencia.' },
    { code: 'OAH g', text: 'Investigar sobre temas del nivel considerando definición de problema, planificación y comunicación de resultados.' },
    { code: 'OAH h', text: 'Aplicar habilidades de pensamiento crítico tales como formular preguntas significativas y fundamentar opiniones.' },
    { code: 'OAH i', text: 'Participar en conversaciones grupales y debates expresando opiniones fundamentadas.' },
    { code: 'OAH j', text: 'Comunicar los resultados de investigaciones de forma oral, escrita y por otros medios.' },
  ];
}

function makeAttitudes() {
  return [
    { code: 'OAA A', text: 'Respetar y defender la igualdad de derechos esenciales de todas las personas.' },
    { code: 'OAA B', text: 'Respetar la diversidad cultural, religiosa y étnica.' },
    { code: 'OAA C', text: 'Pensar en forma autónoma y reflexiva, fundamentar las ideas y posturas propias.' },
    { code: 'OAA D', text: 'Demostrar valoración por el aporte de las ciencias sociales a la comprensión de la realidad humana.' },
    { code: 'OAA E', text: 'Demostrar valoración por la democracia y la importancia de ser ciudadanos activos.' },
    { code: 'OAA F', text: 'Demostrar valoración por la vida en sociedad a través del compromiso activo con la convivencia pacífica.' },
    { code: 'OAA G', text: 'Demostrar interés por conocer el pasado de la humanidad y valorar el conocimiento histórico.' },
    { code: 'OAA H', text: 'Desarrollar actitudes favorables a la protección del medio ambiente.' },
    { code: 'OAA I', text: 'Demostrar una actitud propositiva para contribuir al desarrollo de la sociedad.' },
    { code: 'OAA J', text: 'Usar de manera responsable y efectiva las tecnologías de la comunicación.' },
  ];
}

function prefixed(arr, prefix) {
  return arr.map(s => ({ ...s, code: prefix + ' ' + s.code }));
}

const CURRICULUM_DATA = {
  '5-basico': {
    subject: 'historia-geografia-ciencias-sociales',
    source: 'Bases Curriculares 1°B-6°B',
    version: '2024',
    axes: ['historia', 'geografia', 'formacion-ciudadana'],
    learningObjectives: [
      {
        code: 'HI05 OA 01',
        text: 'Identificar y explicar las principales zonas naturales de Chile, considerando sus características climáticas, relieve, hidrografía y biodiversidad.',
        axis: 'geografia', skills: ['OAH c', 'OAH d'], attitudes: ['OAA H'],
      },
      {
        code: 'HI05 OA 02',
        text: 'Reconocer los principales recursos naturales de Chile y evaluar su importancia para la economía y la vida de las personas.',
        axis: 'geografia', skills: ['OAH d', 'OAH h'], attitudes: ['OAA H', 'OAA I'],
      },
      {
        code: 'HI05 OA 03',
        text: 'Analizar las principales actividades económicas de Chile (minería, agricultura, silvicultura, pesca, turismo, servicios) y su distribución en el territorio nacional.',
        axis: 'geografia', skills: ['OAH d', 'OAH f'], attitudes: ['OAA I'],
      },
      {
        code: 'HI05 OA 04',
        text: 'Caracterizar las regiones de Chile en cuanto a sus principales aspectos físicos, humanos y económicos, utilizando mapas y otras fuentes de información.',
        axis: 'geografia', skills: ['OAH c', 'OAH d', 'OAH f'], attitudes: ['OAA G'],
      },
      {
        code: 'HI05 OA 05',
        text: 'Explicar los principales riesgos naturales presentes en Chile (sismos, tsunamis, erupciones volcánicas, inundaciones) y las medidas de prevención y mitigación.',
        axis: 'geografia', skills: ['OAH d', 'OAH h'], attitudes: ['OAA H'],
      },
      {
        code: 'HI05 OA 06',
        text: 'Reconocer los principales pueblos originarios de Chile (aimara, quechua, atacameño, diaguita, mapuche, rapa nui, kawésqar, yagán) y describir sus características culturales.',
        axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA A', 'OAA B'],
      },
      {
        code: 'HI05 OA 07',
        text: 'Describir el proceso de conquista de Chile, incluyendo las principales expediciones, el rol de los gobernadores y la resistencia mapuche.',
        axis: 'historia', skills: ['OAH a', 'OAH e'], attitudes: ['OAA A', 'OAA G'],
      },
      {
        code: 'HI05 OA 08',
        text: 'Caracterizar la sociedad colonial chilena en sus diversos grupos sociales, actividades económicas, vida cotidiana y el rol de la Iglesia.',
        axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA B', 'OAA G'],
      },
      {
        code: 'HI05 OA 09',
        text: 'Explicar los antecedentes del proceso de independencia de Chile, considerando factores internos y externos.',
        axis: 'historia', skills: ['OAH a', 'OAH b'], attitudes: ['OAA E'],
      },
      {
        code: 'HI05 OA 10',
        text: 'Describir el proceso de independencia de Chile, reconociendo sus principales etapas, personajes y batallas.',
        axis: 'historia', skills: ['OAH a', 'OAH e'], attitudes: ['OAA E', 'OAA G'],
      },
      {
        code: 'HI05 OA 11',
        text: 'Reconocer los símbolos patrios y las principales instituciones de la república de Chile, y valorar su importancia para la identidad nacional.',
        axis: 'formacion-ciudadana', skills: ['OAH h', 'OAH i'], attitudes: ['OAA C', 'OAA E'],
      },
      {
        code: 'HI05 OA 12',
        text: 'Explicar los derechos y deberes de los ciudadanos chilenos, y reconocer la importancia de la participación ciudadana en una sociedad democrática.',
        axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH i'], attitudes: ['OAA C', 'OAA E', 'OAA F'],
      },
      {
        code: 'HI05 OA 13',
        text: 'Utilizar mapas, planos y otros recursos geográficos para ubicar lugares y describir rutas de desplazamiento.',
        axis: 'geografia', skills: ['OAH c', 'OAH d'], attitudes: ['OAA D'],
      },
    ],
    skills: prefixed(makeSkills(), 'HI05'),
    attitudes: prefixed(makeAttitudes(), 'HI05'),
  },
  '6-basico': {
    subject: 'historia-geografia-ciencias-sociales',
    source: 'Bases Curriculares 1°B-6°B',
    version: '2024',
    axes: ['historia', 'geografia', 'formacion-ciudadana'],
    learningObjectives: [
      {
        code: 'HI06 OA 01',
        text: 'Explicar los principales aspectos de la organización política de Chile, incluyendo los tres poderes del Estado y la división administrativa del país.',
        axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E'],
      },
      {
        code: 'HI06 OA 02',
        text: 'Reconocer los principales hitos del proceso de organización de la república de Chile en el siglo XIX, incluyendo la Constitución de 1833 y los gobiernos conservadores.',
        axis: 'historia', skills: ['OAH a', 'OAH b'], attitudes: ['OAA E', 'OAA G'],
      },
      {
        code: 'HI06 OA 03',
        text: 'Describir el proceso de expansión territorial de Chile durante el siglo XIX, incluyendo la ocupación de la Araucanía, la Guerra del Pacífico y la incorporación de Isla de Pascua.',
        axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA A', 'OAA B', 'OAA G'],
      },
      {
        code: 'HI06 OA 04',
        text: 'Caracterizar la sociedad chilena de fines del siglo XIX, considerando la cuestión social, el surgimiento de movimientos obreros y la transformación de la economía.',
        axis: 'historia', skills: ['OAH a', 'OAH f', 'OAH h'], attitudes: ['OAA F', 'OAA I'],
      },
      {
        code: 'HI06 OA 05',
        text: 'Analizar el proceso de democratización de la sociedad chilena durante el siglo XX, incluyendo la ampliación del sufragio, los partidos políticos y las reformas sociales.',
        axis: 'historia', skills: ['OAH b', 'OAH f'], attitudes: ['OAA C', 'OAA E'],
      },
      {
        code: 'HI06 OA 06',
        text: 'Explicar los principales hitos del desarrollo económico de Chile en el siglo XX, desde el salitre hasta la diversificación productiva.',
        axis: 'historia', skills: ['OAH b', 'OAH f'], attitudes: ['OAA G', 'OAA I'],
      },
      {
        code: 'HI06 OA 07',
        text: 'Describir la crisis de la democracia en Chile y el quiebre institucional de 1973, considerando sus causas y consecuencias.',
        axis: 'historia', skills: ['OAH a', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E', 'OAA F'],
      },
      {
        code: 'HI06 OA 08',
        text: 'Analizar el régimen militar chileno (1973-1990) en cuanto a sus transformaciones económicas, sociales y políticas.',
        axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E'],
      },
      {
        code: 'HI06 OA 09',
        text: 'Explicar el proceso de transición a la democracia en Chile y los principales hitos políticos desde 1990 hasta la actualidad.',
        axis: 'formacion-ciudadana', skills: ['OAH b', 'OAH f', 'OAH i'], attitudes: ['OAA C', 'OAA E', 'OAA F'],
      },
      {
        code: 'HI06 OA 10',
        text: 'Valorar los derechos humanos como un logro de la humanidad y analizar las violaciones a estos derechos ocurridas en Chile.',
        axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA C', 'OAA F'],
      },
      {
        code: 'HI06 OA 11',
        text: 'Caracterizar la diversidad geográfica de América Latina en cuanto a relieve, clima, hidrografía y biodiversidad.',
        axis: 'geografia', skills: ['OAH c', 'OAH d'], attitudes: ['OAA D', 'OAA H'],
      },
      {
        code: 'HI06 OA 12',
        text: 'Analizar las principales problemáticas ambientales de Chile y América Latina, y evaluar estrategias para enfrentarlas.',
        axis: 'geografia', skills: ['OAH d', 'OAH h'], attitudes: ['OAA H', 'OAA I'],
      },
      {
        code: 'HI06 OA 13',
        text: 'Explicar los procesos migratorios en Chile y América Latina, reconociendo sus causas y consecuencias.',
        axis: 'geografia', skills: ['OAH d', 'OAH f'], attitudes: ['OAA A', 'OAA B', 'OAA F'],
      },
      {
        code: 'HI06 OA 14',
        text: 'Reconocer a Chile como un país multicultural, valorando los aportes de los pueblos originarios y las diversas comunidades que lo conforman.',
        axis: 'formacion-ciudadana', skills: ['OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA B', 'OAA F'],
      },
      {
        code: 'HI06 OA 15',
        text: 'Analizar críticamente el rol de los medios de comunicación en la formación de opinión y en la difusión de información.',
        axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA J'],
      },
      {
        code: 'HI06 OA 16',
        text: 'Participar de manera activa y responsable en la vida democrática de la comunidad escolar y local.',
        axis: 'formacion-ciudadana', skills: ['OAH i', 'OAH j'], attitudes: ['OAA C', 'OAA E', 'OAA F'],
      },
    ],
    skills: prefixed(makeSkills(), 'HI06'),
    attitudes: prefixed(makeAttitudes(), 'HI06'),
  },
  '7-basico': {
    subject: 'historia-geografia-ciencias-sociales',
    source: 'Bases Curriculares 7°B-2°M',
    version: '2024',
    axes: ['historia', 'geografia', 'formacion-ciudadana'],
    learningObjectives: [
      {
        code: 'HI07 OA 01',
        text: 'Explicar el proceso de hominización, reconociendo las principales etapas de la evolución de la especie humana, la influencia de factores geográficos, su dispersión en el planeta y las distintas teorías del poblamiento americano.',
        axis: 'historia',
        skills: ['HI07 OAH a', 'HI07 OAH e', 'HI07 OAH h'],
        attitudes: ['HI07 OAA A', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 02',
        text: 'Explicar que el surgimiento de la agricultura, la domesticación de animales, la sedentarización, la acumulación de bienes y el desarrollo del comercio, fueron procesos de larga duración que revolucionaron la forma en que los seres humanos se relacionaron con el espacio geográfico.',
        axis: 'historia',
        skills: ['HI07 OAH b', 'HI07 OAH h'],
        attitudes: ['HI07 OAA G', 'HI07 OAA I'],
      },
      {
        code: 'HI07 OA 03',
        text: 'Explicar que en las primeras civilizaciones la formación de estados organizados y el ejercicio del poder estuvieron marcados por la centralización de la administración, la organización en torno a ciudades, la estratificación social, la formación de sistemas religiosos y el desarrollo de técnicas de contabilidad y escritura.',
        axis: 'historia',
        skills: ['HI07 OAH b', 'HI07 OAH f', 'HI07 OAH h'],
        attitudes: ['HI07 OAA A', 'HI07 OAA C'],
      },
      {
        code: 'HI07 OA 04',
        text: 'Caracterizar el surgimiento de las primeras civilizaciones (por ejemplo, sumeria, egipcia, china, india, minoica, fenicia, olmeca y chavín, entre otras), reconociendo que procesos similares se desarrollaron en distintos lugares y tiempos.',
        axis: 'historia',
        skills: ['HI07 OAH a', 'HI07 OAH f'],
        attitudes: ['HI07 OAA A', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 05',
        text: 'Caracterizar el mar Mediterráneo como ecúmene y como espacio de circulación e intercambio, e inferir cómo sus características geográficas (por ejemplo, clima, relieve, recursos naturales, entre otros) influyeron en el desarrollo de la ciudad-estado griega y de la república romana.',
        axis: 'historia',
        skills: ['HI07 OAH c', 'HI07 OAH d', 'HI07 OAH h'],
        attitudes: ['HI07 OAA D', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 06',
        text: 'Analizar las principales características de la democracia en Atenas, considerando el contraste con otras formas de gobierno del mundo antiguo, y su importancia para el desarrollo de la vida política actual y el reconocimiento de los derechos de los ciudadanos.',
        axis: 'formacion-ciudadana',
        skills: ['HI07 OAH f', 'HI07 OAH h', 'HI07 OAH i'],
        attitudes: ['HI07 OAA A', 'HI07 OAA E', 'HI07 OAA F'],
      },
      {
        code: 'HI07 OA 07',
        text: 'Relacionar las principales características de la civilización romana (derecho, organización burocrática y militar, infraestructura, esclavitud, entre otros) con la extensión territorial de su Imperio, la relación con los pueblos conquistados, el proceso de romanización y la posterior expansión del cristianismo.',
        axis: 'historia',
        skills: ['HI07 OAH b', 'HI07 OAH f', 'HI07 OAH h'],
        attitudes: ['HI07 OAA A', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 08',
        text: 'Analizar, apoyándose en fuentes, el canon cultural que se constituyó en la Antigüedad clásica, considerando la centralidad del ser humano y la influencia de esta cultura en diversos aspectos de las sociedades del presente (por ejemplo, escritura alfabética, filosofía, ciencias, historia, noción de sujeto de derecho, relaciones de género, ideal de belleza, deporte, teatro, poesía y artes, entre otros).',
        axis: 'historia',
        skills: ['HI07 OAH e', 'HI07 OAH f', 'HI07 OAH h', 'HI07 OAH j'],
        attitudes: ['HI07 OAA B', 'HI07 OAA D', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 09',
        text: 'Explicar que la civilización europea se conforma a partir de la fragmentación de la unidad imperial de occidente y la confluencia de las tradiciones grecorromana, judeocristiana y germana, e identificar a la Iglesia Católica como el elemento que articuló esta síntesis y que legitimó el poder político.',
        axis: 'historia',
        skills: ['HI07 OAH b', 'HI07 OAH h'],
        attitudes: ['HI07 OAA B', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 10',
        text: 'Caracterizar algunos rasgos distintivos de la sociedad medieval, como la visión cristiana del mundo, el orden estamental, las relaciones de fidelidad, los roles de género, la vida rural y el declive de la vida urbana.',
        axis: 'historia',
        skills: ['HI07 OAH a', 'HI07 OAH f'],
        attitudes: ['HI07 OAA B', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 11',
        text: 'Analizar ejemplos de relaciones de influencia, convivencia y conflicto entre el mundo europeo, el bizantino y el islámico durante la Edad Media, considerando la división del cristianismo y las relaciones de frontera entre la cristiandad y el islam en la península ibérica, entre otros.',
        axis: 'historia',
        skills: ['HI07 OAH f', 'HI07 OAH h'],
        attitudes: ['HI07 OAA A', 'HI07 OAA B'],
      },
      {
        code: 'HI07 OA 12',
        text: 'Analizar las transformaciones que se producen en Europa a partir del siglo XII, considerando el renacimiento de la vida urbana, los cambios demográficos, las innovaciones tecnológicas, el desarrollo del comercio y el surgimiento de las universidades.',
        axis: 'historia',
        skills: ['HI07 OAH b', 'HI07 OAH h'],
        attitudes: ['HI07 OAA G', 'HI07 OAA I'],
      },
      {
        code: 'HI07 OA 13',
        text: 'Identificar las principales características de las civilizaciones maya y azteca, considerando las tecnologías utilizadas para transformar el territorio que habitaban (urbanización, canales, acueductos y calzadas, formas de cultivo, entre otros) y el desarrollo de una red comercial que vinculaba al área mesoamericana.',
        axis: 'historia',
        skills: ['HI07 OAH a', 'HI07 OAH f'],
        attitudes: ['HI07 OAA B', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 14',
        text: 'Caracterizar el Imperio Inca, y analizar los factores que posibilitaron la dominación y unidad del Imperio (por ejemplo, red de caminos y sistema de comunicaciones, sistemas de cultivo, organización social, administración, ejército, mita y yanaconaje, sometimiento de pueblos y lengua oficial, entre otros).',
        axis: 'historia',
        skills: ['HI07 OAH c', 'HI07 OAH f', 'HI07 OAH h'],
        attitudes: ['HI07 OAA B', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 15',
        text: 'Describir las principales características culturales de las civilizaciones maya, azteca e inca (por ejemplo, arte, lengua, tradiciones, relaciones de género, sistemas de medición del tiempo, ritos funerarios y creencias religiosas), e identificar aquellos elementos que persisten hasta el presente.',
        axis: 'historia',
        skills: ['HI07 OAH f', 'HI07 OAH j'],
        attitudes: ['HI07 OAA A', 'HI07 OAA B', 'HI07 OAA G'],
      },
      {
        code: 'HI07 OA 16',
        text: 'Reconocer en expresiones culturales latinoamericanas del presente la confluencia del legado de múltiples civilizaciones como la maya, azteca, inca, griega, romana y europea.',
        axis: 'historia',
        skills: ['HI07 OAH h', 'HI07 OAH j'],
        attitudes: ['HI07 OAA B', 'HI07 OAA G'],
      },
      // Geografía
      {
        code: 'HI07 OA 21',
        text: 'Reconocer procesos de adaptación y transformación que se derivan de la relación entre el ser humano y el medio, e identificar factores que inciden en el asentamiento de las sociedades humanas (por ejemplo, disponibilidad de recursos, cercanía a zonas fértiles, fragilidad del medio ante la acción humana, o la vulnerabilidad de la población ante las amenazas del entorno).',
        axis: 'geografia',
        skills: ['HI07 OAH c', 'HI07 OAH d', 'HI07 OAH h'],
        attitudes: ['HI07 OAA D', 'HI07 OAA H'],
      },
      {
        code: 'HI07 OA 22',
        text: 'Reconocer y explicar formas en que la acción humana genera impactos en el medio y formas en las que el medio afecta a la población, y evaluar distintas medidas para propiciar efectos positivos y mitigar efectos negativos sobre ambos.',
        axis: 'geografia',
        skills: ['HI07 OAH d', 'HI07 OAH h'],
        attitudes: ['HI07 OAA H', 'HI07 OAA I'],
      },
      {
        code: 'HI07 OA 23',
        text: 'Investigar sobre problemáticas medioambientales relacionadas con fenómenos como el calentamiento global, los recursos energéticos, la sobrepoblación, entre otros, y analizar y evaluar su impacto a escala local.',
        axis: 'geografia',
        skills: ['HI07 OAH g', 'HI07 OAH h'],
        attitudes: ['HI07 OAA H', 'HI07 OAA I'],
      },
      // Formación ciudadana
      {
        code: 'HI07 OA 17',
        text: 'Identificar los principios, mecanismos e instituciones que permitieron que en Atenas y en Roma se limitara el ejercicio del poder y se respetaran los derechos ciudadanos (por ejemplo, a través del equilibrio de poderes, del principio de elegibilidad, de la temporalidad de los cargos, de la ley y una cultura de la legalidad, de las magistraturas y del Senado romano, entre otros), reconociendo elementos de continuidad y de cambio con la actualidad.',
        axis: 'formacion-ciudadana',
        skills: ['HI07 OAH b', 'HI07 OAH f', 'HI07 OAH h'],
        attitudes: ['HI07 OAA C', 'HI07 OAA E', 'HI07 OAA F'],
      },
      {
        code: 'HI07 OA 18',
        text: 'Comparar los conceptos de ciudadanía, democracia, derecho, república, municipio y gremio del mundo clásico y medieval, con la sociedad contemporánea.',
        axis: 'formacion-ciudadana',
        skills: ['HI07 OAH b', 'HI07 OAH h'],
        attitudes: ['HI07 OAA C', 'HI07 OAA E'],
      },
      {
        code: 'HI07 OA 19',
        text: 'Reconocer el valor de la diversidad como una forma de enriquecer culturalmente a las sociedades, identificando, a modo de ejemplo, los aportes que las distintas culturas existentes en el mundo antiguo y medieval (árabes, judeocristianos, germanos, eslavos, etc.) hicieron a las sociedades europeas, considerando el lenguaje, la religión y las ciencias, entre otros.',
        axis: 'formacion-ciudadana',
        skills: ['HI07 OAH f', 'HI07 OAH h', 'HI07 OAH i'],
        attitudes: ['HI07 OAA A', 'HI07 OAA B'],
      },
      {
        code: 'HI07 OA 20',
        text: 'Reconocer distintas formas de convivencia y conflicto entre culturas en las civilizaciones estudiadas, y debatir sobre la importancia que tienen el respeto, la tolerancia y las estrategias de resolución pacífica de conflictos, entre otros, para la convivencia entre distintos pueblos y culturas.',
        axis: 'formacion-ciudadana',
        skills: ['HI07 OAH h', 'HI07 OAH i'],
        attitudes: ['HI07 OAA A', 'HI07 OAA B', 'HI07 OAA F'],
      },
    ],
    skills: [
      { code: 'HI07 OAH a', text: 'Interpretar periodizaciones históricas mediante líneas de tiempo, reconociendo la duración, la sucesión y la simultaneidad de acontecimientos o procesos históricos vistos en el nivel.' },
      { code: 'HI07 OAH b', text: 'Analizar elementos de continuidad y cambio entre periodos y procesos abordados en el nivel.' },
      { code: 'HI07 OAH c', text: 'Representar la ubicación y características de los lugares, y los diferentes tipos de información geográfica, por medio de la construcción de mapas a diferentes escalas y de la utilización de herramientas geográficas y tecnológicas.' },
      { code: 'HI07 OAH d', text: 'Interpretar datos e información geográfica, utilizando tecnología apropiada para identificar distribuciones espaciales y patrones (por ejemplo, población, cultivo, ciudades, regiones, entre otros), y explicar las relaciones entre estos.' },
      { code: 'HI07 OAH e', text: 'Seleccionar fuentes de información, considerando la confiabilidad de la fuente (autor, origen o contexto, intención), la relación con el tema y el uso de diversas fuentes.' },
      { code: 'HI07 OAH f', text: 'Analizar y comparar la información obtenida de diversas fuentes para utilizarla como evidencia para elaborar y responder preguntas sobre temas del nivel.' },
      { code: 'HI07 OAH g', text: 'Investigar sobre temas del nivel, considerando definición de problema, planificación, aplicación de estrategias, elaboración de conclusiones y comunicación de resultados.' },
      { code: 'HI07 OAH h', text: 'Aplicar habilidades de pensamiento crítico tales como formular preguntas significativas, formular inferencias fundadas, fundamentar opiniones, comparar críticamente distintos puntos de vista y evaluar alternativas.' },
      { code: 'HI07 OAH i', text: 'Participar en conversaciones grupales y debates, expresando opiniones fundamentadas mediante fuentes, respetando puntos de vista y formulando preguntas relacionadas con el tema.' },
      { code: 'HI07 OAH j', text: 'Comunicar los resultados de sus investigaciones de forma oral, escrita y por otros medios, utilizando una estructura lógica y efectiva, y argumentos basados en evidencia pertinente.' },
    ],
    attitudes: [
      { code: 'HI07 OAA A', text: 'Respetar y defender la igualdad de derechos esenciales de todas las personas, sin distinción de raza o etnia, nacionalidad, situación socioeconómica, idioma, ideología u opinión política, religión o creencia, sindicación o participación en organizaciones gremiales o la falta de ellas, género, orientación sexual, estado civil, edad, filiación, apariencia personal, enfermedad o discapacidad.' },
      { code: 'HI07 OAA B', text: 'Respetar la diversidad cultural, religiosa y étnica, y las ideas y creencias distintas de las propias, considerando la importancia del diálogo para la convivencia y el logro de acuerdos, evitando prejuicios.' },
      { code: 'HI07 OAA C', text: 'Pensar en forma autónoma y reflexiva, fundamentar las ideas y posturas propias, y desarrollar una disposición positiva a la crítica y la autocrítica.' },
      { code: 'HI07 OAA D', text: 'Demostrar valoración por el aporte de las ciencias sociales a la comprensión de la realidad humana y su complejidad, mediante distintas herramientas metodológicas y perspectivas de análisis.' },
      { code: 'HI07 OAA E', text: 'Demostrar valoración por la democracia, reconociendo la importancia de ser ciudadanos activos, solidarios y responsables, conscientes y comprometidos con el ejercicio de sus derechos y deberes.' },
      { code: 'HI07 OAA F', text: 'Demostrar valoración por la vida en sociedad, a través del compromiso activo con la convivencia pacífica, el bien común, la igualdad de hombres y mujeres y el respeto a los derechos fundamentales de todas las personas.' },
      { code: 'HI07 OAA G', text: 'Demostrar interés por conocer el pasado de la humanidad y el de su propia cultura, y valorar el conocimiento histórico como una forma de comprender el presente y desarrollar lazos de pertenencia con la sociedad en sus múltiples dimensiones (familia, localidad, región, país, humanidad, etc.).' },
      { code: 'HI07 OAA H', text: 'Desarrollar actitudes favorables a la protección del medio ambiente, demostrando conciencia de su importancia para la vida en el planeta y una actitud propositiva ante la necesidad de lograr un desarrollo sustentable.' },
      { code: 'HI07 OAA I', text: 'Demostrar una actitud propositiva para contribuir al desarrollo de la sociedad, mediante iniciativas que reflejen responsabilidad social y creatividad en la búsqueda de soluciones, perseverancia, empatía y compromiso ético con el bien común.' },
      { code: 'HI07 OAA J', text: 'Usar de manera responsable y efectiva las tecnologías de la comunicación para la obtención de información y la elaboración de evidencia, dando crédito al trabajo de otros y respetando la propiedad y la privacidad de las personas.' },
    ],
  },
  '8-basico': {
    subject: 'historia-geografia-ciencias-sociales',
    source: 'Bases Curriculares 7°B-2°M',
    version: '2024',
    axes: ['historia', 'geografia', 'formacion-ciudadana'],
    learningObjectives: [
      {
        code: 'HI08 OA 01',
        text: 'Explicar las transformaciones de Europa durante la Edad Moderna, considerando el Renacimiento, la Reforma religiosa, el desarrollo del comercio y la formación de los Estados nacionales.',
        axis: 'historia', skills: ['OAH a', 'OAH b', 'OAH f'], attitudes: ['OAA B', 'OAA G'],
      },
      {
        code: 'HI08 OA 02',
        text: 'Analizar el proceso de expansión europea y la formación de los imperios coloniales en América, África y Asia, considerando sus causas y consecuencias.',
        axis: 'historia', skills: ['OAH b', 'OAH f'], attitudes: ['OAA A', 'OAA B'],
      },
      {
        code: 'HI08 OA 03',
        text: 'Explicar la construcción del Estado moderno en Europa, considerando la centralización del poder, la burocracia y el rol de los ejércitos.',
        axis: 'historia', skills: ['OAH b', 'OAH f'], attitudes: ['OAA C'],
      },
      {
        code: 'HI08 OA 04',
        text: 'Caracterizar el absolutismo como forma de gobierno en la Europa de los siglos XVII y XVIII, identificando sus principales exponentes.',
        axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA C', 'OAA E'],
      },
      {
        code: 'HI08 OA 05',
        text: 'Analizar las revoluciones atlánticas (Revolución Francesa, Independencia de Estados Unidos) y su impacto en la difusión de ideas liberales y democráticas.',
        axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E'],
      },
      {
        code: 'HI08 OA 06',
        text: 'Explicar el proceso de independencia de las colonias americanas, considerando sus causas comunes y las particularidades de cada región.',
        axis: 'historia', skills: ['OAH a', 'OAH b', 'OAH f'], attitudes: ['OAA E', 'OAA G'],
      },
      {
        code: 'HI08 OA 07',
        text: 'Describir el proceso de formación de los Estados nacionales en América Latina durante el siglo XIX.',
        axis: 'historia', skills: ['OAH a', 'OAH b'], attitudes: ['OAA E', 'OAA G'],
      },
      {
        code: 'HI08 OA 08',
        text: 'Analizar las transformaciones económicas y sociales de la Revolución Industrial y su impacto en la sociedad contemporánea.',
        axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA I'],
      },
      {
        code: 'HI08 OA 09',
        text: 'Explicar el surgimiento del capitalismo y el desarrollo del pensamiento liberal y socialista en el siglo XIX.',
        axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA I'],
      },
      {
        code: 'HI08 OA 10',
        text: 'Analizar el imperialismo europeo del siglo XIX y su impacto en África, Asia y Oceanía.',
        axis: 'historia', skills: ['OAH b', 'OAH f'], attitudes: ['OAA A', 'OAA B'],
      },
      {
        code: 'HI08 OA 11',
        text: 'Explicar las causas de la Primera Guerra Mundial y analizar sus consecuencias políticas, sociales y territoriales.',
        axis: 'historia', skills: ['OAH a', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA F'],
      },
      {
        code: 'HI08 OA 12',
        text: 'Analizar el período de entreguerras, considerando la crisis de 1929, el surgimiento de los totalitarismos y sus consecuencias.',
        axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E', 'OAA F'],
      },
      {
        code: 'HI08 OA 13',
        text: 'Explicar las causas y consecuencias de la Segunda Guerra Mundial, y analizar el impacto del Holocausto en la conciencia ética de la humanidad.',
        axis: 'historia', skills: ['OAH a', 'OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA C', 'OAA F'],
      },
      {
        code: 'HI08 OA 14',
        text: 'Analizar la Guerra Fría como un período de tensión geopolítica, caracterizado por la bipolarización del mundo y los conflictos regionales.',
        axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E'],
      },
      {
        code: 'HI08 OA 15',
        text: 'Explicar el proceso de descolonización en Asia y África durante la segunda mitad del siglo XX.',
        axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA A', 'OAA B'],
      },
      {
        code: 'HI08 OA 16',
        text: 'Analizar los principales desafíos del mundo contemporáneo, como la globalización, el cambio climático, las migraciones y la desigualdad.',
        axis: 'geografia', skills: ['OAH d', 'OAH f', 'OAH h'], attitudes: ['OAA H', 'OAA I'],
      },
      {
        code: 'HI08 OA 17',
        text: 'Identificar los principales organismos internacionales y evaluar su rol en la promoción de la paz, los derechos humanos y el desarrollo.',
        axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA C', 'OAA E', 'OAA F'],
      },
      {
        code: 'HI08 OA 18',
        text: 'Reconocer la Declaración Universal de los Derechos Humanos como un hito fundamental y analizar su aplicación en la actualidad.',
        axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA C', 'OAA F'],
      },
      {
        code: 'HI08 OA 19',
        text: 'Analizar los principales desafíos de la democracia en el mundo contemporáneo, incluyendo la participación ciudadana y la protección de los derechos.',
        axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA C', 'OAA E', 'OAA F'],
      },
      {
        code: 'HI08 OA 20',
        text: 'Explicar la importancia de los medios de comunicación y las redes sociales en la formación de opinión pública y en la participación ciudadana.',
        axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA J'],
      },
      {
        code: 'HI08 OA 21',
        text: 'Analizar la relación entre la globalización y la identidad cultural, considerando tanto sus oportunidades como sus desafíos.',
        axis: 'geografia', skills: ['OAH d', 'OAH f', 'OAH h'], attitudes: ['OAA B', 'OAA D'],
      },
      {
        code: 'HI08 OA 22',
        text: 'Participar en debates sobre temas controversiales del mundo contemporáneo, fundamentando posturas y respetando la diversidad de opiniones.',
        axis: 'formacion-ciudadana', skills: ['OAH h', 'OAH i', 'OAH j'], attitudes: ['OAA A', 'OAA C', 'OAA F'],
      },
    ],
    skills: prefixed(makeSkills(), 'HI08'),
    attitudes: prefixed(makeAttitudes(), 'HI08'),
  },
  '1-medio': {
    subject: 'historia-geografia-ciencias-sociales',
    source: 'Bases Curriculares 1°M',
    version: '2024',
    axes: ['historia', 'geografia', 'formacion-ciudadana'],
    learningObjectives: [
      { code: 'HI1M OA 01', text: 'Analizar la crisis del mundo medieval y el surgimiento del Renacimiento, considerando sus causas y su impacto en la cultura europea.', axis: 'historia', skills: ['OAH a', 'OAH b', 'OAH f'], attitudes: ['OAA B', 'OAA G'] },
      { code: 'HI1M OA 02', text: 'Explicar la expansión europea durante la Edad Moderna, considerando los descubrimientos geográficos y sus consecuencias.', axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA A', 'OAA B'] },
      { code: 'HI1M OA 03', text: 'Analizar la Reforma protestante y la Contrarreforma, considerando sus causas religiosas, políticas y económicas.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA B', 'OAA C'] },
      { code: 'HI1M OA 04', text: 'Caracterizar el absolutismo monárquico y el surgimiento del Estado moderno en Europa.', axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA C', 'OAA E'] },
      { code: 'HI1M OA 05', text: 'Analizar el pensamiento ilustrado y su influencia en la crítica al absolutismo y en los procesos revolucionarios.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E'] },
      { code: 'HI1M OA 06', text: 'Explicar la Revolución Francesa y sus consecuencias en la difusión de las ideas de libertad, igualdad y fraternidad.', axis: 'historia', skills: ['OAH a', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E', 'OAA F'] },
      { code: 'HI1M OA 07', text: 'Analizar el proceso de independencia de las colonias americanas y la formación de los nuevos Estados.', axis: 'historia', skills: ['OAH a', 'OAH b'], attitudes: ['OAA E', 'OAA G'] },
      { code: 'HI1M OA 08', text: 'Explicar el desarrollo del pensamiento liberal y la formación de las repúblicas americanas durante el siglo XIX.', axis: 'formacion-ciudadana', skills: ['OAH b', 'OAH f', 'OAH i'], attitudes: ['OAA C', 'OAA E'] },
      { code: 'HI1M OA 09', text: 'Analizar los principales rasgos de la geografía humana y física de América, considerando su diversidad.', axis: 'geografia', skills: ['OAH c', 'OAH d'], attitudes: ['OAA D', 'OAA H'] },
      { code: 'HI1M OA 10', text: 'Analizar las principales problemáticas sociales y económicas de América Latina en el siglo XIX y XX.', axis: 'historia', skills: ['OAH f', 'OAH h'], attitudes: ['OAA F', 'OAA I'] },
      { code: 'HI1M OA 11', text: 'Valorar los derechos humanos y analizar su aplicación en el contexto americano y mundial.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA C', 'OAA F'] },
      { code: 'HI1M OA 12', text: 'Analizar los desafíos de la democracia contemporánea y la importancia de la participación ciudadana.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA C', 'OAA E', 'OAA F'] },
    ],
    skills: prefixed(makeSkills(), 'HI1M'),
    attitudes: prefixed(makeAttitudes(), 'HI1M'),
  },
  '2-medio': {
    subject: 'historia-geografia-ciencias-sociales',
    source: 'Bases Curriculares 2°M',
    version: '2024',
    axes: ['historia', 'geografia', 'formacion-ciudadana'],
    learningObjectives: [
      { code: 'HI2M OA 01', text: 'Analizar la Revolución Industrial y sus consecuencias económicas, sociales y culturales.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA I'] },
      { code: 'HI2M OA 02', text: 'Explicar el surgimiento de las ideologías políticas del siglo XIX (liberalismo, socialismo, nacionalismo) y su impacto.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA I'] },
      { code: 'HI2M OA 03', text: 'Analizar el imperialismo europeo del siglo XIX y XX y sus consecuencias para Asia, África y Oceanía.', axis: 'historia', skills: ['OAH b', 'OAH f'], attitudes: ['OAA A', 'OAA B'] },
      { code: 'HI2M OA 04', text: 'Explicar las causas y consecuencias de la Primera Guerra Mundial.', axis: 'historia', skills: ['OAH a', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA F'] },
      { code: 'HI2M OA 05', text: 'Analizar el período de entreguerras, incluyendo la crisis de 1929 y el surgimiento de los totalitarismos.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E'] },
      { code: 'HI2M OA 06', text: 'Explicar las causas y consecuencias de la Segunda Guerra Mundial y analizar el Holocausto.', axis: 'historia', skills: ['OAH a', 'OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA C', 'OAA F'] },
      { code: 'HI2M OA 07', text: 'Analizar la Guerra Fría, la bipolarización del mundo y los principales conflictos regionales.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E'] },
      { code: 'HI2M OA 08', text: 'Explicar el proceso de descolonización en Asia y África durante la segunda mitad del siglo XX.', axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA A', 'OAA B'] },
      { code: 'HI2M OA 09', text: 'Analizar el proceso de globalización y sus efectos en la economía, la cultura y la política mundial.', axis: 'geografia', skills: ['OAH d', 'OAH f', 'OAH h'], attitudes: ['OAA B', 'OAA D'] },
      { code: 'HI2M OA 10', text: 'Explicar los principales desafíos ambientales globales y las estrategias para el desarrollo sustentable.', axis: 'geografia', skills: ['OAH d', 'OAH h'], attitudes: ['OAA H', 'OAA I'] },
      { code: 'HI2M OA 11', text: 'Analizar el papel de los organismos internacionales en la promoción de la paz y los derechos humanos.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA C', 'OAA E', 'OAA F'] },
      { code: 'HI2M OA 12', text: 'Valorar la diversidad cultural y analizar las identidades en el mundo contemporáneo.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA B', 'OAA F'] },
    ],
    skills: prefixed(makeSkills(), 'HI2M'),
    attitudes: prefixed(makeAttitudes(), 'HI2M'),
  },
  '3-medio': {
    subject: 'historia-geografia-ciencias-sociales',
    source: 'Bases Curriculares 3°M',
    version: '2024',
    axes: ['historia', 'formacion-ciudadana'],
    learningObjectives: [
      { code: 'HI3M OA 01', text: 'Analizar el proceso de formación del Estado chileno en el siglo XIX, considerando la construcción de la república.', axis: 'historia', skills: ['OAH a', 'OAH b', 'OAH f'], attitudes: ['OAA C', 'OAA E', 'OAA G'] },
      { code: 'HI3M OA 02', text: 'Explicar la expansión territorial de Chile durante el siglo XIX y sus consecuencias.', axis: 'historia', skills: ['OAH a', 'OAH f'], attitudes: ['OAA A', 'OAA B', 'OAA G'] },
      { code: 'HI3M OA 03', text: 'Analizar la cuestión social y el surgimiento de los movimientos obreros en Chile.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA F', 'OAA I'] },
      { code: 'HI3M OA 04', text: 'Explicar el proceso de democratización de la sociedad chilena durante el siglo XX.', axis: 'historia', skills: ['OAH b', 'OAH f'], attitudes: ['OAA C', 'OAA E'] },
      { code: 'HI3M OA 05', text: 'Analizar la crisis de la democracia chilena y el quiebre institucional de 1973.', axis: 'historia', skills: ['OAH a', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E', 'OAA F'] },
      { code: 'HI3M OA 06', text: 'Explicar el régimen militar y la transición a la democracia en Chile.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA E'] },
      { code: 'HI3M OA 07', text: 'Analizar los principales desafíos de la democracia chilena contemporánea.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA C', 'OAA E', 'OAA F'] },
      { code: 'HI3M OA 08', text: 'Valorar los derechos humanos y analizar su situación en Chile desde una perspectiva crítica.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA C', 'OAA F'] },
      { code: 'HI3M OA 09', text: 'Analizar la participación ciudadana y el rol de las organizaciones de la sociedad civil en Chile.', axis: 'formacion-ciudadana', skills: ['OAH i', 'OAH j'], attitudes: ['OAA C', 'OAA E', 'OAA F'] },
      { code: 'HI3M OA 10', text: 'Analizar la inserción de Chile en el mundo globalizado y sus implicancias económicas y culturales.', axis: 'historia', skills: ['OAH d', 'OAH f', 'OAH h'], attitudes: ['OAA B', 'OAA D'] },
    ],
    skills: prefixed(makeSkills(), 'HI3M'),
    attitudes: prefixed(makeAttitudes(), 'HI3M'),
  },
  '4-medio': {
    subject: 'historia-geografia-ciencias-sociales',
    source: 'Bases Curriculares 4°M',
    version: '2024',
    axes: ['historia', 'formacion-ciudadana'],
    learningObjectives: [
      { code: 'HI4M OA 01', text: 'Analizar los principales procesos históricos del mundo contemporáneo y su impacto en la sociedad actual.', axis: 'historia', skills: ['OAH b', 'OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA G'] },
      { code: 'HI4M OA 02', text: 'Explicar la relación entre desarrollo económico, desigualdad y bienestar social en el mundo actual.', axis: 'historia', skills: ['OAH d', 'OAH f', 'OAH h'], attitudes: ['OAA F', 'OAA I'] },
      { code: 'HI4M OA 03', text: 'Analizar los principales desafíos ambientales del siglo XXI y las propuestas de desarrollo sustentable.', axis: 'geografia', skills: ['OAH d', 'OAH h'], attitudes: ['OAA H', 'OAA I'] },
      { code: 'HI4M OA 04', text: 'Analizar los desafíos de la democracia, la ciudadanía y los derechos humanos en el mundo contemporáneo.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA C', 'OAA E', 'OAA F'] },
      { code: 'HI4M OA 05', text: 'Evaluar críticamente el rol de los medios de comunicación y las tecnologías digitales en la sociedad.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h'], attitudes: ['OAA C', 'OAA J'] },
      { code: 'HI4M OA 06', text: 'Analizar los procesos migratorios globales y sus implicancias sociales, económicas y culturales.', axis: 'geografia', skills: ['OAH d', 'OAH f'], attitudes: ['OAA A', 'OAA B', 'OAA F'] },
      { code: 'HI4M OA 07', text: 'Valorar la diversidad cultural y analizar los debates sobre identidad en un mundo globalizado.', axis: 'formacion-ciudadana', skills: ['OAH f', 'OAH h', 'OAH i'], attitudes: ['OAA A', 'OAA B', 'OAA D'] },
      { code: 'HI4M OA 08', text: 'Elaborar proyectos de investigación que contribuyan al bien común, aplicando metodologías de las ciencias sociales.', axis: 'historia', skills: ['OAH g', 'OAH j'], attitudes: ['OAA C', 'OAA I', 'OAA J'] },
    ],
    skills: prefixed(makeSkills(), 'HI4M'),
    attitudes: prefixed(makeAttitudes(), 'HI4M'),
  },
};

async function ingestCurriculum() {
  const db = getFirestore();

  for (const [level, data] of Object.entries(CURRICULUM_DATA)) {
    console.log(`\n📚 Ingresando nivel: ${level}`);
    console.log(`   Asignatura: ${data.subject}`);
    console.log(`   Ejes: ${data.axes.join(', ')}`);
    console.log(`   OA: ${data.learningObjectives.length}`);
    console.log(`   Habilidades: ${data.skills.length}`);
    console.log(`   Actitudes: ${data.attitudes.length}`);

    // Ingresar OA
    for (const oa of data.learningObjectives) {
      const docRef = await db.collection('curriculum').add({
        ...oa,
        level,
        subject: data.subject,
        source: data.source,
        version: data.version,
        isActive: true,
        validFrom: new Date('2024-01-01').toISOString(),
        validTo: null,
        createdAt: new Date().toISOString(),
      });
      console.log(`   ✅ OA ${oa.code} → ${docRef.id}`);
    }

    // Ingresar habilidades
    for (const skill of data.skills) {
      await db.collection('curriculum').add({
        type: 'skill',
        ...skill,
        level,
        subject: data.subject,
        source: data.source,
        version: data.version,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      console.log(`   ✅ Habilidad ${skill.code}`);
    }

    // Ingresar actitudes
    for (const attitude of data.attitudes) {
      await db.collection('curriculum').add({
        type: 'attitude',
        ...attitude,
        level,
        subject: data.subject,
        source: data.source,
        version: data.version,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      console.log(`   ✅ Actitud ${attitude.code}`);
    }
  }

  console.log('\n✅ Ingesta curricular completada.');
}

initializeApp();
ingestCurriculum()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
