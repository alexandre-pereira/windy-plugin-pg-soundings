<!-- Légende repliable : un bouton ⓘ en coin de graphique ouvre un panneau par-dessus -->
<button
    class="wpp-lg-btn"
    class:wpp-lg-btn--open={open}
    title={open ? tr('Fermer la légende', 'Close legend') : tr('Afficher la légende', 'Show legend')}
    aria-label={tr('Légende', 'Legend')}
    on:click={() => (open = !open)}
>
    {#if open}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
            ><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg
        >
    {:else}
        <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true"
            ><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.3" /><path
                d="M8 7.2v4.1"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
            /><circle cx="8" cy="4.8" r="0.95" fill="currentColor" /></svg
        >
    {/if}
</button>

{#if open}
    <div class="wpp-lg">
        {#if kind === 'chart'}
            <div class="wpp-lg__title">{tr('Graphique vent & thermiques', 'Wind & thermals chart')}</div>
            {#each scales as s}
                <div class="wpp-lg__scale">
                    <div class="wpp-lg__label">{s.label} <small>{s.unit}</small></div>
                    <div class="wpp-lg__bar" style="background:{s.gradient}"></div>
                    <div class="wpp-lg__ticks">
                        {#each s.ticks as v, k}
                            <span
                                class:wpp-lg-first={k === 0}
                                class:wpp-lg-last={k === s.ticks.length - 1}
                                style="left:{(v / s.max) * 100}%">{v}</span
                            >
                        {/each}
                    </div>
                </div>
            {/each}
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14"
                        ><path
                            d={arrow}
                            transform="translate(13,7) rotate(90)"
                            fill={windColor(25)}
                            stroke="#0f1822"
                            stroke-width="0.7"
                            stroke-opacity="0.8"
                        /></svg
                    >
                    <span>{tr("Vent : la flèche va dans le sens du vent, chiffre en km/h", "Wind: the arrow points downwind, value in km/h")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="3" y1="7" x2="23" y2="7" stroke="#0f1822" stroke-opacity="0.45" stroke-width="5.5" stroke-linecap="round" /><line
                            x1="3"
                            y1="7"
                            x2="23"
                            y2="7"
                            stroke="#ffffff"
                            stroke-width="2.4"
                            stroke-linecap="round"
                        /><circle
                            cx="13"
                            cy="7"
                            r="2.8"
                            fill="#ffffff"
                            stroke="#0b1118"
                        /></svg
                    >
                    <span>{tr("Plafond exploitable : au-dessus, le thermique ne porte plus l'aile", "Usable ceiling: above it, the thermal no longer carries the glider")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><path d={cu} fill="#fff" stroke="#243244" stroke-width="1.1" stroke-linejoin="round" /></svg
                    >
                    <span>{tr("Cumulus des thermiques (blanc), de la base au sommet estimé, aux heures de thermiques exploitables ; d’autant plus larges que le modèle prévoit de nuages dans leur couche", "Thermal cumulus (white), from base to estimated top, at hours with usable thermals; the wider, the more cloud the model forecasts in their layer")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><path d={showerCu} fill="#9ea9ba" stroke="#243244" stroke-width="1.1" stroke-linejoin="round" /><path
                            d="M10.5 10.5l-1.2 3M14 10.5l-1.2 3M17.5 10.5l-1.2 3"
                            stroke="#2f7cf6"
                            stroke-width="1.3"
                            stroke-linecap="round"
                        /></svg
                    >
                    <span>{tr("Nuage d’averses (gris, bourgeonnant), de sa base à son sommet : nuage que le modèle développe lui-même, même sans thermiques (nuit, ciel couvert). Les averses d’heures qui se suivent ne font qu’une masse. La nature de la pluie se juge sur l’heure et les deux de chaque côté : une pluie de front, elle, tombe d’une nappe grise", "Shower cloud (grey, billowing), from base to top: a cloud the model develops by itself, even without thermals (night, overcast). Showers at consecutive hours form a single mass. The kind of rain is judged over the hour and the two on each side: frontal rain falls from a grey sheet instead")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" stroke="#5fd3ff" stroke-width="1.6" stroke-dasharray="6 4" /></svg
                    >
                    <span>{tr("Isotherme 0 °C", "Freezing level (0 °C)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="2" y="0" width="22" height="14" rx="2" fill="#4a8fd0" /><line
                            x1="4"
                            y1="7"
                            x2="22"
                            y2="7"
                            stroke="#e4dcff"
                            stroke-width="1.6"
                            stroke-dasharray="1.5 4"
                            stroke-linecap="round"
                        /></svg
                    >
                    <span>{tr("Limite pluie-neige, aux heures de précipitations : au-dessus, les flocons ne fondent pas (thermomètre mouillé à +1 °C). Dans un air sec, elle est nettement plus basse que l’isotherme 0 °C", "Snow line, at hours with precipitation: above it, snowflakes do not melt (wet-bulb temperature of +1 °C). In dry air it is well below the freezing level")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><path d="M9 3l4 4l4 -4M9 8l4 4l4 -4" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg
                    >
                    <span>{tr("Virga : averses dont la base est à plus de 1 500 m du sol. La pluie s’évapore en tombant dans l’air sec et le refroidit : il descend en rafales, même sans pluie au sol", "Virga: showers whose base is more than 1,500 m above the ground. Rain evaporates as it falls through dry air and cools it: the air comes down in gusts, even with no rain at the ground")}</span>
                </li>
                <li>
                    <svg width="26" height="16"
                        ><path d="M9 2l4 4l4 -4M9 7l4 4l4 -4M9 12l4 4l4 -4" fill="none" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg
                    >
                    <span>{tr("Virga dans un air très sec : trois chevrons rouges. L’air refroidi par la pluie qui s’évapore a de quoi descendre vite (énergie de la descente d’environ 400 J/kg ou plus) : fortes rafales possibles sous le nuage et autour. Seuil non vérifié sur des observations", "Virga in very dry air: three red chevrons. The air cooled by the evaporating rain can come down fast (downdraft energy of about 400 J/kg or more): strong gusts possible under the cloud and around it. Threshold not checked against observations")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="2" y="0" width="22" height="14" rx="2" fill="#1d3a5c" /><path
                            d="M7 3q6,-4 12,0M9 8q4,-3 8,0M11 12q2,-2 4,0"
                            fill="none"
                            stroke="#f3d9a4"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        /></svg
                    >
                    <span>{tr("Tourbillons de poussière (« dusts ») possibles, au ras du sol : thermiques puissants (air qui monte à 2,5 m/s ou plus) dans une couche d’au moins 1 500 m, vent au sol faible devant eux, air sec (au moins 10 °C entre la température et le point de rosée), moins de 1 mm de pluie depuis 24 h et plein soleil. Ce sont leurs ingrédients, pas une prévision : aucune observation ne permet de vérifier ces seuils, et le modèle ne dit ni où ni quand ils se forment", "Dust devils possible, at ground level: strong thermals (air rising at 2.5 m/s or more) in a layer at least 1,500 m deep, surface wind light compared with them, dry air (at least 10 °C between temperature and dew point), less than 1 mm of rain in 24 h and full sun. These are their ingredients, not a forecast: no observations can check these thresholds, and the model says neither where nor when they form")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="2" y="0" width="22" height="14" rx="2" fill="#1d3a5c" /><path
                            d="M5 9q4,-9 8,0t8,0"
                            fill="none"
                            stroke="#ffffff"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        /></svg
                    >
                    <span>{tr("Ondes de relief possibles, en montagne : au moins 30 km/h de vent au niveau des crêtes voisines, dans un air stable où le vent forcit avec l’altitude sans tourner. Rotors possibles sous le vent du relief. L’orientation des crêtes n’est pas connue : c’est un signal, pas une carte", "Mountain waves possible, in the mountains: at least 30 km/h of wind at the level of the nearby ridges, in stable air where the wind strengthens with height without turning. Rotors possible downwind of the terrain. The orientation of the ridges is not known: this is a signal, not a map")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><rect x="3" y="2" width="20" height="10" rx="2" fill="#ced6e1" /></svg>
                    <span>{tr("Voile gris : nébulosité du modèle à chaque altitude, d’autant plus opaque que les nuages y couvrent le ciel", "Grey veil: the model’s cloud cover at each altitude, the more opaque the more cloud covers the sky there")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="2" y="0" width="22" height="14" rx="2" fill="#4a8fd0" /><rect x="2" y="4" width="22" height="7" fill="#dce3ed" /><line
                            x1="2"
                            x2="24"
                            y1="4"
                            y2="4"
                            stroke="#ffffff"
                            stroke-width="2"
                        /><line x1="2" x2="24" y1="11" y2="11" stroke="#8c99ad" stroke-width="1.4" /></svg
                    >
                    <span>{tr("Nappe : la plus basse couche où le modèle prévoit au moins 50 % de nuages, soulignée d’un trait sombre à sa base. C’est le plafond nuageux de l’heure. Couche basse (stratus, stratocumulus, base à moins de 2 000 m du sol, brouillard si elle le touche) : dessinée jusqu’à son sommet, souligné de blanc pour une mer de nuages, sous un air clair et sec. Couche épaisse, ou de l’étage haut : elle s’estompe en montant, son sommet se perd dans le voile. Base et sommet sont placés entre deux niveaux du modèle, à quelques centaines de mètres près", "Sheet: the lowest layer where the model forecasts at least 50 % cloud, underlined by a dark line at its base. It is the cloud ceiling of the hour. Low layer (stratus, stratocumulus, base less than 2,000 m above the ground, fog if it touches it): drawn up to its top, underlined in white for a sea of clouds, under clear dry air. Thick or high-level layer: it fades upwards, its top merging into the veil. Base and top are placed between two model levels, accurate to a few hundred metres")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="2" y="0" width="22" height="14" rx="2" fill="#4a8fd0" /><path
                            d="M2 11V6.5a3.2 3.2 0 0 1 5.5 0a2.4 2.4 0 0 1 4.5 0a3.4 3.4 0 0 1 6 0a3.2 3.2 0 0 1 6 0V11Z"
                            fill="#dce3ed"
                        /><line x1="2" x2="24" y1="11" y2="11" stroke="#8c99ad" stroke-width="1.4" /></svg
                    >
                    <span>{tr("Dessus moutonné : couche en amas, séparés par des trouées, plutôt qu’en nappe continue. Couche basse que les thermiques nourrissent (cumulus, stratocumulus), ou couche mince de l’étage moyen, à plus de 2 000 m du sol (altocumulus). Une couche épaisse de l’étage moyen garde un dessus lisse : altostratus, ou altocumulus épais", "Lumpy top: a layer of clumps separated by gaps, rather than a continuous sheet. Low layer fed by thermals (cumulus, stratocumulus), or thin mid-level layer, more than 2,000 m above the ground (altocumulus). A thick mid-level layer keeps a smooth top: altostratus, or thick altocumulus")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="2" y="0" width="22" height="14" rx="2" fill="#78b0e2" /><rect x="2" y="0" width="22" height="7" fill="#9ea9ba" /><line
                            x1="2"
                            x2="24"
                            y1="7"
                            y2="7"
                            stroke="#5c687c"
                            stroke-width="1.6"
                        /><path d="M8.5 8.5l-1.4 4M13.5 8.5l-1.4 4M18.5 8.5l-1.4 4" stroke="#2f7cf6" stroke-width="1.3" stroke-linecap="round" /></svg
                    >
                    <span>{tr("Nappe grise : la pluie en tombe (pluie de front, bruine sous un stratus), rideau de pluie dessous", "Grey sheet: the rain falls from it (frontal rain, drizzle under stratus), with a rain curtain below")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="2" y="0" width="22" height="14" rx="2" fill="#4a8fd0" /><path
                            d="M4 3.5h7M15 3.5h7M8 7h7M19 7h3M4 10.5h7M15 10.5h7"
                            stroke="#d6dde8"
                            stroke-width="1.5"
                        /></svg
                    >
                    <span>{tr("Tirets : relief pris dans les nuages. L’air y est saturé (moins de 1,5 °C entre la température et le point de rosée) et condense sur les pentes, même là où le modèle n’annonce pas de couche. Dessinés seulement en montagne, du sol au niveau des crêtes voisines (pointillé brun, triangle sur l’axe) : le plus haut du terrain à 10 km à la ronde. Rien dans une nappe : elle dit déjà que le relief y est dans les nuages", "Dashes: terrain in cloud. The air there is saturated (less than 1.5 °C between temperature and dew point) and condenses on the slopes, even where the model forecasts no layer. Drawn only in the mountains, from the ground to the level of the nearby ridges (brown dotted line, triangle on the axis): the highest terrain within 10 km. Nothing inside a sheet: it already says the terrain there is in cloud")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><linearGradient id="wpp-lg-glow" x1="0" y1="0" x2="0" y2="1"
                            ><stop offset="0" stop-color="#ced6e1" /><stop offset="0.75" stop-color="#ced6e1" stop-opacity="0" /></linearGradient
                        ><rect x="3" y="2" width="20" height="10" rx="1" fill="#3a78ba" /><rect x="3" y="2" width="20" height="10" rx="1" fill="url(#wpp-lg-glow)" /></svg
                    >
                    <span>{tr("Halo clair sous le bord supérieur : nuages plus hauts que le graphique", "Light glow under the top edge: clouds higher than the chart")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="1" y="3" width="7.5" height="9" rx="1.5" fill="#6b7280" fill-opacity="0.12" /><rect
                            x="9.25"
                            y="3"
                            width="7.5"
                            height="9"
                            rx="1.5"
                            fill="#6b7280"
                            fill-opacity="0.5"
                        /><rect x="17.5" y="3" width="7.5" height="9" rx="1.5" fill="#6b7280" /></svg
                    >
                    <span>{tr("Bandeau « Nuages », au-dessus du graphique : une case par heure, où est écrite la part du ciel que prennent les nuages (%), tous étages confondus, y compris plus haut que le graphique. La case est d’autant plus grise que le ciel est couvert, de transparente (ciel dégagé) à grise (ciel couvert), de jour comme de nuit", "“Clouds” strip, above the chart: one cell per hour, showing the share of the sky taken by clouds (%) at all levels, including higher than the chart. The more overcast the sky, the greyer the cell, from transparent (clear sky) to grey (overcast), by day and by night alike")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><rect x="3" y="2" width="20" height="10" rx="3" fill="#06090f" opacity="0.6" /></svg>
                    <span>{tr("Nuit", "Night")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="13" y1="0" x2="13" y2="14" stroke="#ff5a5a" stroke-width="1.5" stroke-dasharray="4 3" /></svg
                    >
                    <span>{tr("Heure actuelle", "Current time")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="1" y1="10.5" x2="25" y2="10.5" stroke={FRONT.cold.color} stroke-width="2.2" /><path
                            d="M3.5 10.5l4.5-7l4.5 7zM14 10.5l4.5-7l4.5 7z"
                            fill={FRONT.cold.color}
                        /></svg
                    >
                    <span>{tr("Passage d’un front froid, lu sur la carte autour du lieu : vers 1 500 m d’altitude, la masse d’air (température et humidité ensemble) change vite d’un endroit à l’autre, et le vent pousse cet air plus froid sur le lieu, où elle change d’au moins 5 °C en 6 h (ou 7 °C en 12 h pour un front lent). Le trait suit la surface du front : il part du sol à l’heure où l’air commence à changer près du sol (le vent y tourne), passe vers 1 500 m à l’heure où il commence à y changer, et rejoint l’heure où l’air change plus haut, jusqu’à 6 h plus tard. Il s’arrête à 3 000 m au-dessus du sol : plus haut, le front n’est pas repéré. Le front est dit « sec » quand il passe avec moins de 1 mm de pluie. L’infobulle des heures que le trait traverse donne le refroidissement, la rotation du vent, la pluie et les heures du passage au sol et en altitude. Le symbole du front suit aussi le nom du jour où il passe, dans la liste des jours", "Cold front passage, read on the map around the place: at about 1,500 m the air mass (temperature and humidity together) changes quickly from one place to the next, and the wind pushes this colder air over the place, where it changes by at least 5 °C in 6 h (or 7 °C in 12 h for a slow front). The line follows the frontal surface: it starts from the ground at the hour when the air near the ground starts to change (the wind shifts there), passes about 1,500 m at the hour when it starts to change there, and reaches the hour when the air changes higher up, up to 6 h later. It stops 3,000 m above the ground: higher up the front is not tracked. The front is called “dry” when it passes with less than 1 mm of rain. The tooltip of the hours the line crosses gives the cooling, the wind shift, the rain and the hours of the passage at the ground and aloft. The front symbol also follows the name of the day it passes, in the list of days")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="1" y1="10.5" x2="25" y2="10.5" stroke={FRONT.warm.color} stroke-width="2.2" /><path
                            d="M3.5 10.5a4.5 4.5 0 0 1 9 0zM14 10.5a4.5 4.5 0 0 1 9 0z"
                            fill={FRONT.warm.color}
                        /></svg
                    >
                    <span>{tr("Passage d’un front chaud : le vent pousse sur le lieu une masse d’air plus chaude, de la même façon. Son trait part du sol à l’heure où l’air finit de changer près du sol et penche vers l’arrière : le front passe en altitude avant d’arriver au sol. La carte est lue en quatre points à 55 km du lieu, chargés après lui : les fronts apparaissent un instant après le graphique. Si ces points ne répondent pas, les fronts sont cherchés sur le lieu seul, et un front peu actif peut manquer. Vitesse : le retard du passage aux points voisins donne la vitesse et la direction du front (infobulle) ; à 50 km/h ou plus, il est dit « rapide ». L’infobulle donne aussi les rafales au sol quand elles montent d’au moins 15 km/h au passage. Quand Windy ne fournit le modèle que toutes les 3 heures, l’heure du passage n’est connue qu’à ce pas près : l’infobulle donne les deux heures (« entre 13h et 16h »)", "Warm front passage: the wind pushes a warmer air mass over the place, in the same way. Its line starts from the ground at the hour when the air near the ground finishes changing and leans backwards: the front passes aloft before reaching the ground. The map is read at four points 55 km from the place, loaded after it: fronts appear a moment after the chart. If these points do not answer, fronts are looked for on the place alone, and a weak front can be missed. Speed: the delay of the passage at the surrounding points gives the speed and direction of the front (tooltip); at 50 km/h or more it is called “fast”. The tooltip also gives the surface gusts when they rise by at least 15 km/h at the passage. When Windy only provides the model every 3 hours, the hour of the passage is only known to within that step: the tooltip gives both hours (“between 13h and 16h”)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="1" y1="10.5" x2="25" y2="10.5" stroke={FRONT.occluded.color} stroke-width="2.2" /><path
                            d="M3.5 10.5l4.5-7l4.5 7zM14 10.5a4.5 4.5 0 0 1 9 0z"
                            fill={FRONT.occluded.color}
                        /></svg
                    >
                    <span>{tr("Occlusion : une langue d’air chaud passe en altitude (l’air y gagne puis reperd au moins 1,5 °C), sous un ciel couvert et une pluie de nuages en couches, sans que l’air change près du sol", "Occluded front: a tongue of warm air passes aloft (the air there gains then loses at least 1.5 °C), under an overcast sky and rain from layered cloud, while the air near the ground does not change")}</span>
                </li>
                <li>
                    <svg width="26" height="20"
                        ><circle cx="13" cy="10" r="8.5" fill="none" stroke="#ef4444" stroke-width="1.3" stroke-dasharray="3 2.5" /><g opacity="0.75"><StormIcon level={2} size={12} x={7} y={4} /></g></svg
                    >
                    <span>{tr("Orage cerclé de tirets : le modèle en prévoit un à 55 km (au nord, au sud, à l’est ou à l’ouest), que le vent pousse vers le lieu, sans en prévoir sur le lieu à ces heures. L’icône est à l’heure où il peut arriver ; un bandeau le dit au-dessus des onglets", "Storm in a dashed circle: the model forecasts one 55 km away (north, south, east or west), pushed towards the place by the wind, with none over the place at these hours. The icon sits at the hour it may arrive; a banner says so above the tabs")}</span>
                </li>
                <li>
                    <span class="wpp-lg__icons"><StormIcon level={1} size={14} /></span>
                    <span>{tr("Surdéveloppement possible : cumulus qui ont de quoi dépasser 2 000 m d’épaisseur, ou averses convectives prévues par le modèle", "Overdevelopment possible: cumulus with enough energy to grow over 2,000 m deep, or convective showers forecast by the model")}</span>
                </li>
                <li>
                    <span class="wpp-lg__icons"><StormIcon level={2} size={14} /></span>
                    <span>{tr("Orage probable : cumulonimbus (sommet au-dessus de −20 °C, CAPE ≥ 300 J/kg). L’absence d’icône ne garantit pas l’absence d’orage.", "Thunderstorm likely: cumulonimbus (top above −20 °C, CAPE ≥ 300 J/kg). No icon does not guarantee no storm.")}</span>
                </li>
                <li>
                    <span class="wpp-lg__icons"><StormIcon level={3} size={14} /></span>
                    <span>{tr("Orage violent possible : orage probable dans un air très instable (LI ≤ −6), ou instable avec un vent fort en altitude qui organise l’orage, ou avec des rafales d’au moins 70 km/h au modèle. Un bandeau au-dessus des onglets résume l’orage du jour : heure, déplacement, rafales.", "Severe thunderstorm possible: thunderstorm likely in very unstable air (LI ≤ −6), or unstable air with strong winds aloft that organise the storm, or with model gusts of 70 km/h or more. A banner above the tabs sums up the day’s storm: time, motion, gusts.")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="4" y="5" width="8" height="9" rx="1.5" fill="#5aa8ff" /><rect x="14" y="2" width="8" height="12" rx="1.5" fill="#e4dcff" /></svg
                    >
                    <span>{tr("Précipitations de l’heure qui suit (mm) : pluie en bleu, neige en violet pâle", "Precipitation over the following hour (mm): rain in blue, snow in pale violet")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-opacity="0.4" /><circle
                            cx="13"
                            cy="3.5"
                            r="2.2"
                            fill="currentColor"
                        /><circle cx="13" cy="10.5" r="2.2" fill="currentColor" /></svg
                    >
                    <span>{tr("Points sur l’axe des altitudes : niveaux où le modèle fournit ses données (leur altitude moyenne sur les heures affichées). Entre deux points, vent, température et nuages sont interpolés : un plafond qui tombe entre deux points éloignés est moins sûr", "Dots on the altitude axis: levels where the model provides its data (their mean altitude over the hours shown). Between two dots, wind, temperature and cloud are interpolated: a ceiling that falls between two distant dots is less certain")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="0" y="0" width="26" height="14" rx="2" fill="#6b523c" /><path
                            d={surfArrow}
                            transform="translate(7,7) rotate(90)"
                            fill={windColor(15)}
                            stroke="#0f1822"
                            stroke-width="0.7"
                            stroke-opacity="0.8"
                        /><text
                            x="13.5"
                            y="10.5"
                            font-size="9.5"
                            font-weight="bold"
                            fill={windColor(15)}
                            stroke="#0f1822"
                            stroke-width="2.8"
                            stroke-opacity="0.85"
                            stroke-linejoin="round"
                            paint-order="stroke">15</text
                        ></svg
                    >
                    <span>{tr("Vent moyen au sol (km/h) et sa direction, aux couleurs du vent : écrit dans le relief brun du graphique, sous la ligne du sol (« Vent » sur l’axe)", "Mean surface wind (km/h) and its direction, in the wind colours: written in the brown terrain of the chart, under the ground line (“Wind” on the axis)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><rect x="2" y="0" width="22" height="14" rx="2" fill="#6b523c" /><text
                            x="13"
                            y="10.5"
                            font-size="9.5"
                            font-weight="bold"
                            text-anchor="middle"
                            fill={windColor(35)}
                            stroke="#0f1822"
                            stroke-width="2.8"
                            stroke-opacity="0.85"
                            stroke-linejoin="round"
                            paint-order="stroke">35</text
                        ></svg
                    >
                    <span>{tr("Rafales au sol (km/h), aux couleurs du vent : écrites dans le relief, sous le vent moyen (« Raf. » sur l’axe)", "Surface gusts (km/h), in the wind colours: written in the terrain, under the mean wind (“Gust” on the axis)")}</span>
                </li>
            </ul>
            <div class="wpp-lg__subtitle">
                {tr('Infobulle, ligne « Thermiques » : leur qualité', 'Tooltip, “Thermals” line: their quality')}
            </div>
            <svg width="0" height="0" style="position:absolute" aria-hidden="true"
                ><pattern id="wpp-lg-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"
                    ><rect width="1.6" height="4" fill="#111" fill-opacity="0.5" /></pattern
                ></svg
            >
            <ul class="wpp-lg__list">
                {#each easeItems as e}
                    <li>
                        <svg width="26" height="14"
                            ><rect x="3" y="3" width="20" height="9" rx="2" fill={e.color} />{#if e.hatch}<rect
                                    x="3"
                                    y="3"
                                    width="20"
                                    height="9"
                                    rx="2"
                                    fill="url(#wpp-lg-hatch)"
                                />{/if}</svg
                        >
                        <span><b>{e.label}</b> — {e.text}</span>
                    </li>
                {/each}
            </ul>
            <div class="wpp-lg__subtitle">{tr('Bandeau « CAPE LI » : instabilité de chaque heure, CAPE à gauche de la case, LI à droite', '“CAPE LI” strip: instability of each hour, CAPE on the left of the cell, LI on the right')}</div>
            {#each instability as ix}
                <p class="wpp-lg__ix"><b>{ix.name}</b> <small>{ix.unit}</small> — {ix.text}</p>
                <ul class="wpp-lg__levels">
                    {#each ix.levels as lv}<li><i style="background:{lv.color}"></i><b>{lv.range}</b><span>{lv.text}</span></li>{/each}
                </ul>
            {/each}
            <p class="wpp-lg__note">{instabilityNote}</p>
            <p class="wpp-lg__note">
                {@html tr(
                    "Couleurs des thermiques : <b>montée au vario</b> (ascendance moins ~1,1 m/s de taux de chute en spirale).",
                    "Thermal colours: <b>vario climb</b> (updraft minus ~1.1 m/s of circling sink).",
                )}
            </p>
            <p class="wpp-lg__note">
                {@html tr(
                    "Plafond, cumulus et ascendance sont <b>estimés</b> : une inversion fine peut échapper au modèle et le plafond être surestimé.",
                    "Ceiling, cumulus and climb rates are <b>estimated</b>: the model can miss a thin inversion and overestimate the ceiling.",
                )}
            </p>
            <p class="wpp-lg__note">
                {tr(
                    "Survolez pour lire les valeurs, cliquez sur une heure pour ouvrir son émagramme. Au doigt : touchez une heure pour la lire, ou gardez le doigt appuyé un instant puis glissez pour lire en continu.",
                    "Hover to read values, click an hour to open its sounding. By touch: tap an hour to read it, or hold your finger down for a moment then slide to read continuously.",
                )}
            </p>
        {:else}
            <div class="wpp-lg__title">{tr('Émagramme redressé', 'Skewed emagram')}</div>
            <p class="wpp-lg__note">
                {tr(
                    "Altitude en mètres. L'axe des températures est « redressé » : les adiabatiques sèches sont verticales et les isothermes obliques. Une courbe qui penche vers la gauche se refroidit plus vite qu'une adiabatique sèche.",
                    'Altitude in metres. The temperature axis is skewed so that dry adiabats are vertical and isotherms slanted. A curve leaning left cools faster than a dry adiabat.',
                )}
            </p>
            <div class="wpp-lg__subtitle">{tr("Courbe d'état (température de l'air)", 'Temperature curve (air temperature)')}</div>
            <ul class="wpp-lg__list">
                {#each stabilityItems as s}
                    <li>
                        <svg width="26" height="14"
                            ><line x1="2" y1="7" x2="24" y2="7" style="stroke: {s.color}" stroke-width="3" /></svg
                        >
                        <span><b style="color:{s.color}">{s.label}</b> — {s.text}</span>
                    </li>
                {/each}
            </ul>
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14" class="wpp-lg__level"
                        ><line x1="2" y1="7" x2="24" y2="7" stroke-width="3" /><circle cx="13" cy="7" r="2.6" /></svg
                    >
                    <span
                        >{tr(
                            "Points creux : niveaux où le modèle fournit ses données. Entre deux points, les courbes sont interpolées. Entre le sol et le premier niveau, quand le sol est surchauffé, l'air surchauffé est dessiné dans les 100 premiers mètres, puis la courbe suit l'adiabatique sèche jusqu'à ce niveau",
                            "Hollow dots: levels where the model provides its data. Between two dots, the curves are interpolated. Between the ground and the first level, when the ground is superheated, the superheated air is drawn in the lowest 100 m, then the curve follows the dry adiabat up to that level",
                        )}</span
                    >
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-fg-faint)" stroke-width="1.8" /></svg
                    >
                    <span
                        >{tr(
                            "Courbe d'état du lever du jour (option en bas de page), en trait pâle avec son heure : l'écart avec la courbe de l'heure affichée montre ce que la journée a changé",
                            "Temperature curve at sunrise (option at the bottom of the page), as a pale line with its hour: the gap with the curve of the hour shown tells what the day has changed",
                        )}</span
                    >
                </li>
            </ul>
            <div class="wpp-lg__subtitle">{tr('Autres courbes', 'Other lines')}</div>
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14"><line x1="2" y1="7" x2="24" y2="7" stroke="#4ea3ff" stroke-width="2.4" /></svg>
                    <span>{tr("Point de rosée : plus il est loin de la courbe d'état, plus l'air est sec ; quand les deux se touchent, il y a condensation (nuage)", "Dew point: the further from the temperature curve, the drier the air; where they touch, there is condensation (cloud)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-parcel)" stroke-width="1.6" stroke-dasharray="6 4" /></svg
                    >
                    <span>{tr("Particule : trajet d'un thermique parti du sol", "Parcel: path of a thermal rising from the ground")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-parcel)" stroke-width="2.6" /></svg
                    >
                    <span
                        >{tr(
                            "Ascension de la particule (option en bas de page) : trait plein du sol jusqu'où le thermique s'arrête, sommet des thermiques ou du cumulus ; zone teintée : elle est plus chaude que l'air",
                            "Parcel ascent (option at the bottom of the page): solid line from the ground to where the thermal stops, thermal top or cumulus top; tinted area: it is warmer than the air",
                        )}</span
                    >
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-dew)" stroke-width="2" stroke-dasharray="7 5" /></svg
                    >
                    <span
                        >{tr(
                            "Point de rosée de la particule : il la rejoint au niveau de condensation (point jaune, creux si le thermique s'arrête avant)",
                            "Dew point of the parcel: it meets the parcel at the condensation level (yellow dot, hollow if the thermal stops below it)",
                        )}</span
                    >
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-parcel)" stroke-width="2.6" /><line
                            x1="2"
                            y1="7"
                            x2="24"
                            y2="7"
                            style="stroke: var(--wpp-dew)"
                            stroke-width="2.6"
                            stroke-dasharray="6 6"
                        /></svg
                    >
                    <span
                        >{tr(
                            "Passage de l'adiabatique sèche à la saturée : la particule est en jaune jusqu'au niveau de condensation, en jaune et bleu au-dessus",
                            "Switch from the dry adiabat to the moist one: the parcel is yellow up to the condensation level, yellow and blue above it",
                        )}</span
                    >
                </li>
                <li>
                    <svg width="26" height="14"><line x1="13" y1="0" x2="13" y2="14" stroke="#4caf50" stroke-opacity="0.8" /></svg>
                    <span>{tr("Adiabatique sèche : refroidissement de l'air sec qui monte (~10 °C/km)", "Dry adiabat: cooling of rising dry air (~10 °C/km)")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="10" y1="14" x2="15" y2="0" stroke="#4caf50" stroke-opacity="0.8" stroke-dasharray="4 3" /></svg
                    >
                    <span>{tr("Adiabatique saturée : refroidissement de l'air saturé, dans un nuage", "Moist adiabat: cooling of saturated air, inside a cloud")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><line x1="4" y1="14" x2="22" y2="0" stroke="#c9d1db" stroke-opacity="0.6" /></svg>
                    <span>{tr("Isotherme (0 °C en bleu), valeurs en haut du cadre", "Isotherm (0 °C in blue), values at the top of the frame")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="4" y1="14" x2="22" y2="0" style="stroke: var(--wpp-freezing)" stroke-opacity="0.75" stroke-width="1.4" /><circle
                            cx="13"
                            cy="7"
                            r="3.6"
                            style="fill: var(--wpp-freezing); stroke: var(--wpp-halo)"
                            stroke-width="1.5"
                        /></svg
                    >
                    <span>{tr("Point bleu : isotherme 0 °C, là où la courbe d'état croise l'isotherme bleue", "Blue dot: freezing level, where the temperature curve crosses the blue isotherm")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="9" y1="14" x2="17" y2="0" stroke="#f0b13a" stroke-dasharray="1.5 3" /></svg
                    >
                    <span>{tr("Rapport de mélange (g/kg) : quantité de vapeur d'eau", "Mixing ratio (g/kg): amount of water vapour")}</span>
                </li>
                <li>
                    <svg width="26" height="14"
                        ><line x1="2" y1="7" x2="24" y2="7" style="stroke: var(--wpp-fg)" stroke-width="1.3" stroke-dasharray="6 3" /></svg
                    >
                    <span>{tr("Base et sommet des cumulus, ou plafond thermique", "Cumulus base and top, or thermal ceiling")}</span>
                </li>
                <li>
                    <svg width="26" height="14" class="wpp-lg__cloud"
                        ><rect x="1" y="0" width="24" height="14" rx="2" /><path d={emaCloud.fill} /><path d={emaCloud.edge} /></svg
                    >
                    <span
                        >{tr(
                            "Zone de formation du nuage : le cumulus des thermiques, de sa base (niveau de condensation) à son sommet, où le thermique, dilué par l'air qui l'entoure, cesse d'être plus léger que lui",
                            "Cloud formation zone: the cumulus fed by the thermals, from its base (condensation level) to its top, where the thermal, diluted by the surrounding air, stops being lighter than it",
                        )}</span
                    >
                </li>
            </ul>
            <div class="wpp-lg__subtitle">{tr('Colonne de droite', 'Right column')}</div>
            <ul class="wpp-lg__list">
                <li>
                    <svg width="26" height="14" class="wpp-lg__strip"
                        ><rect x="9" y="0" width="8" height="14" /><rect x="9" y="3" width="8" height="6" /><line
                            x1="9"
                            x2="17"
                            y1="9"
                            y2="9"
                        /></svg
                    >
                    <span
                        >{tr(
                            "Bande des nuages (☁) : nébulosité du modèle à chaque altitude, d'autant plus opaque que les nuages y couvrent le ciel ; trait à la base du plafond nuageux de l'heure",
                            "Cloud strip (☁): the model's cloud cover at each altitude, the more opaque the more cloud covers the sky there; a line at the base of the hour's cloud ceiling",
                        )}</span
                    >
                </li>
                <li>
                    <svg width="26" height="14"
                        ><path d={arrow} transform="translate(13,7) rotate(90)" fill={windColor(35, light)} /></svg
                    >
                    <span>{tr("Vent en km/h : taille et couleur selon la force", "Wind in km/h: size and colour by strength")}</span>
                </li>
                <li>
                    <svg width="26" height="14"><rect x="3" y="1" width="20" height="12" rx="2" fill="#ffe14a" opacity="0.4" /></svg>
                    <span>{tr("Couche convective (zone des thermiques)", "Convective layer (thermal zone)")}</span>
                </li>
            </ul>
            <div class="wpp-lg__subtitle">{tr("CAPE et LI (sous l'émagramme)", 'CAPE and LI (below the sounding)')}</div>
            {#each instability as ix}
                <p class="wpp-lg__ix"><b>{ix.name}</b> <small>{ix.unit}</small> — {ix.text}</p>
                <ul class="wpp-lg__levels">
                    {#each ix.levels as lv}<li><i style="background:{lv.color}"></i><b>{lv.range}</b><span>{lv.text}</span></li>{/each}
                </ul>
            {/each}
            <p class="wpp-lg__note">{instabilityNote}</p>
            <p class="wpp-lg__note">
                {tr(
                    "Au doigt : touchez pour lire une altitude, ou gardez le doigt appuyé un instant puis glissez pour lire en continu.",
                    'By touch: tap to read an altitude, or hold your finger down for a moment then slide to read continuously.',
                )}
            </p>
            <p class="wpp-lg__note">
                {tr(
                    "« max » : CAPE de l'air le plus instable, quand il se trouve plus haut que les 1 000 premiers mètres. C'est lui qui nourrit un orage venu d'ailleurs, même si l'air près du sol est stable (soir, nuit).",
                    '“max”: CAPE of the most unstable air, when it lies above the lowest 1,000 m. It is what feeds a storm arriving from elsewhere, even when the air near the ground is stable (evening, night).',
                )}
            </p>
            <p class="wpp-lg__note">
                {tr(
                    "Sous ces valeurs : le risque d'orage de l'heure affichée, et l'orage attendu dans les 3 heures qui suivent.",
                    'Below these values: the storm risk of the hour shown, and any storm expected within the next 3 hours.',
                )}
            </p>
        {/if}
    </div>
{/if}

<script lang="ts">
    import { EASE, FRONT } from './Chart.svelte';
    import { STABILITY } from './Emagram.svelte';
    import { INSTABILITY_COLORS, thermalColor, windColor } from './physics';
    import { arrowPath, cloudBand, cumulusPath } from './svg';
    import { tr } from './i18n';
    import StormIcon from './StormIcon.svelte';

    export let kind: 'chart' | 'emagram';
    /** Thème clair : couleurs du vent plus soutenues à côté de l'émagramme (le graphique ne change pas) */
    export let light = false;

    let open = false;

    const range = (from: number, to: number, step: number) => {
        const out: number[] = [];
        for (let v = from; v <= to + 1e-6; v += step) out.push(v);
        return out;
    };

    const gradientCss = (color: (v: number) => string, max: number) =>
        `linear-gradient(to right, ${range(0, max, max / 20)
            .map(v => `${color(v)} ${((v / max) * 100).toFixed(1)}%`)
            .join(', ')})`;

    $: scales = [
        {
            label: tr('Vent', 'Wind'),
            unit: 'km/h',
            max: 55,
            ticks: [0, 10, 20, 30, 40, 55],
            gradient: gradientCss(v => windColor(v), 55),
        },
        {
            label: tr('Montée au vario', 'Vario climb'),
            unit: 'm/s',
            max: 3.5,
            ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3.5],
            gradient: gradientCss(thermalColor, 3.5),
        },
    ];

    const arrow = arrowPath(16, 5.5, 4, 1.2);
    const surfArrow = arrowPath(11, 4.5, 3.4, 1);
    const cu = cumulusPath(13, 13, 22, 12);
    const showerCu = cumulusPath(13, 9, 16, 8.5);
    const emaCloud = cloudBand(1, 25, 12, 3);

    // Qualité des thermiques donnée par l'infobulle, des plus francs aux plus hachés
    const easeItems = [
        {
            ...EASE.easy,
            text: tr(
                'au moins +0,5 m/s au vario et 300 m de hauteur exploitable, sans vent fort, ni pluie, ni risque d’orage',
                'at least +0.5 m/s on the vario and 300 m of usable height, without strong wind, rain or storm risk',
            ),
        },
        {
            ...EASE.unsettled,
            text: tr(
                'au moins 0,5 mm de pluie dans l’heure, ou surdéveloppement ou orage signalé en haut de la colonne : la qualité des thermiques n’est pas donnée',
                'at least 0.5 mm of rain in the hour, or overdevelopment or a storm flagged at the top of the column: thermal quality is not given',
            ),
        },
        {
            ...EASE.weak,
            label: tr('faibles ou plafond bas', 'weak or low ceiling'),
            text: tr(
                'moins de +0,5 m/s au vario, moins de 300 m au-dessus du sol ou, en montagne, plafond sous le niveau des crêtes voisines : difficiles à tenir',
                'under +0.5 m/s on the vario, less than 300 m above the ground or, in the mountains, a ceiling below the level of the nearby ridges: hard to stay in',
            ),
        },
        {
            ...EASE.choppy,
            text: tr(
                'plus de 25 km/h de vent dans la couche thermique, plus de 20 km/h d’écart entre le vent au sol et le vent au plafond, ou vent au sol fort pour des thermiques faibles : difficiles à centrer',
                'over 25 km/h of wind in the thermal layer, over 20 km/h of difference between the surface wind and the wind at the ceiling, or strong surface wind for weak thermals: hard to centre',
            ),
        },
        {
            ...EASE.rough,
            text: tr(
                'plus de 40 km/h dans la couche, plus de 35 km/h d’écart entre le sol et le plafond, ou vent au sol très fort pour la force des thermiques : inexploitables',
                'over 40 km/h in the layer, over 35 km/h of difference between the surface and the ceiling, or very strong surface wind for the thermal strength: unusable',
            ),
        },
    ];

    const stabilityItems = [
        { ...STABILITY.absolute, text: tr(
                "l'air se refroidit plus vite que l'adiabatique sèche : les thermiques accélèrent",
                'air cools faster than the dry adiabat: thermals accelerate',
            ),
        },
        {
            ...STABILITY.conditional,
            text: tr(
                "entre l'adiabatique saturée et la sèche : les thermiques peuvent accélérer dans certaines conditions",
                'between the moist and dry adiabats: thermals can accelerate under some conditions',
            ),
        },
        { ...STABILITY.stable, color: 'var(--wpp-stable)', text: tr("l'air se refroidit lentement : les thermiques sont freinés", 'air cools slowly: thermals are damped'),
        },
    ];

    // Seuils usuels de la CAPE et de l'indice de soulèvement, du plus calme au plus orageux
    const levels = (items: [string, string][]) => items.map(([range, text], k) => ({ range, text, color: INSTABILITY_COLORS[k] }));

    const instability = [
        {
            name: 'CAPE',
            unit: 'J/kg',
            text: tr(
                "énergie d'une bulle d'air qui monte : le « carburant » des orages.",
                'energy of a rising air bubble: the “fuel” of thunderstorms.',
            ),
            levels: levels([
                ['< 200', tr('faible : convection peu profonde', 'weak: shallow convection')],
                ['200 – 650', tr('modérée : cumulus bourgeonnants, averses possibles', 'moderate: towering cumulus, showers possible')],
                [tr('650 – 1 600', '650 – 1,600'), tr('forte : orages si la convection se déclenche', 'strong: thunderstorms if convection triggers')],
                [tr('> 1 600', '> 1,600'), tr('très forte : orages violents possibles', 'very strong: severe storms possible')],
            ]),
        },
        {
            name: 'LI',
            unit: '°C',
            text: tr(
                "indice de soulèvement : négatif, la bulle est encore plus chaude que l'air vers 5 500 m et continue de monter.",
                'lifted index: when negative, the bubble is still warmer than the air around 5,500 m and keeps rising.',
            ),
            levels: levels([
                ['> 0', tr('stable : convection peu profonde', 'stable: shallow convection')],
                [tr('0 à −3', '0 to −3'), tr('faiblement instable : averses possibles', 'slightly unstable: showers possible')],
                [tr('−3 à −6', '−3 to −6'), tr('instable : orages possibles', 'unstable: thunderstorms possible')],
                [tr('< −6', '< −6'), tr('très instable : orages violents possibles', 'very unstable: severe storms possible')],
            ]),
        },
    ];

    const instabilityNote = tr(
        "Valeurs standard (air des 1 000 premiers mètres, sans chauffage du sol), à la couleur de leur palier. La CAPE s'arrête au dernier niveau fourni par le modèle (souvent 400 hPa, vers 7 000 m) : elle vaut environ les deux tiers d'une CAPE complète, et ses paliers sont abaissés d'autant. Un potentiel seulement : il faut un déclencheur, et une couche stable peut tout bloquer.",
        'Standard values (air of the lowest 1,000 m, no ground heating), in the colour of their level. CAPE stops at the highest level the model provides (often 400 hPa, around 7,000 m): it is about two thirds of a full CAPE, and its levels are lowered accordingly. A potential only: it takes a trigger, and a stable layer can block everything.',
    );
</script>

<style lang="less">
    // Bouton ⓘ carré, à la hauteur des onglets
    .wpp-lg-btn {
        flex: none;
        display: grid;
        place-items: center;
        width: 38px;
        min-height: 34px;
        padding: 0;
        border: 1px solid var(--wpp-border);
        border-radius: 10px;
        background: var(--wpp-surface);
        color: var(--wpp-fg-dim);
        cursor: pointer;
        transition:
            background 0.15s,
            color 0.15s;
        // Sur téléphone, à la hauteur des onglets, qui tiennent sur une ligne
        @container wpp (max-width: 560px) {
            width: 32px;
            min-height: 28px;
            border-radius: 8px;
        }

        &:hover {
            background: var(--wpp-surface-hover);
            color: var(--wpp-fg);
        }
        &--open,
        &--open:hover {
            background: #ffd24a;
            border-color: #ffd24a;
            color: #111;
        }
    }

    .wpp-lg {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 8;
        width: min(360px, 100%);
        max-height: 580px;
        overflow-y: auto;
        padding: 12px 14px;
        border-radius: 10px;
        background: var(--wpp-popup-bg);
        border: 1px solid var(--wpp-popup-border);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
        font-size: 11.5px;
        line-height: 1.45;
        color: var(--wpp-fg-dim);

        &__title {
            font-size: 13px;
            font-weight: bold;
            color: var(--wpp-fg);
            margin-bottom: 8px;
        }
        &__subtitle {
            margin: 10px 0 4px;
            font-weight: bold;
            color: var(--wpp-fg);
        }
        &__scale {
            margin-bottom: 8px;
        }
        &__label {
            margin-bottom: 3px;
            color: var(--wpp-fg);
            font-weight: bold;
            small {
                font-weight: normal;
                color: var(--wpp-fg-faint);
            }
        }
        &__bar {
            height: 8px;
            border-radius: 4px;
        }
        &__ticks {
            position: relative;
            height: 14px;
            margin-top: 2px;
            span {
                position: absolute;
                top: 0;
                transform: translateX(-50%);
                font-size: 10px;
                color: var(--wpp-fg-faint);
                &.wpp-lg-first {
                    transform: none;
                }
                &.wpp-lg-last {
                    transform: translateX(-100%);
                }
            }
        }
        &__icons {
            flex: none;
            display: inline-flex;
            justify-content: center;
            width: 26px;
        }
        &__list {
            list-style: none;
            margin: 0;
            padding: 0;
            li {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin: 5px 0;
            }
            svg {
                flex: none;
                margin-top: 1px;
            }
        }
        // Point d'un niveau du modèle sur la courbe d'état
        &__level {
            line {
                stroke: var(--wpp-stable);
            }
            circle {
                fill: var(--wpp-halo);
                stroke: var(--wpp-stable);
                stroke-width: 1.3;
            }
        }
        // Bande des nuages de l'émagramme, sur un morceau de son fond
        &__strip {
            rect {
                fill: var(--wpp-sky-top);
            }
            rect + rect {
                fill: var(--wpp-cloud-layer);
            }
            line {
                stroke: var(--wpp-fg);
                stroke-width: 1.6;
            }
        }
        // Nuage de l'émagramme, sur un morceau de son fond
        &__cloud {
            rect {
                fill: var(--wpp-sky-top);
            }
            path {
                fill: var(--wpp-cloud);
            }
            path + path {
                fill: none;
                stroke: var(--wpp-line);
                stroke-opacity: 0.4;
            }
        }
        &__ix {
            margin: 6px 0 3px;
            b {
                color: var(--wpp-fg);
            }
            small {
                color: var(--wpp-fg-faint);
            }
        }
        // Seuils : pastille, plage de valeurs, signification
        &__levels {
            display: grid;
            grid-template-columns: auto auto 1fr;
            gap: 2px 6px;
            align-items: start;
            list-style: none;
            margin: 0 0 4px;
            padding: 0;
            li {
                display: contents;
            }
            i {
                width: 8px;
                height: 8px;
                margin-top: 4px;
                border-radius: 50%;
            }
            b {
                color: var(--wpp-fg);
                font-weight: 600;
                white-space: nowrap;
            }
        }
        &__note {
            margin: 8px 0 0;
            font-size: 11px;
            opacity: 0.8;
        }
    }
</style>
