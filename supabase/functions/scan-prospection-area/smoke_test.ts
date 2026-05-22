import {
  type AreaConfig,
  countCommuneCommerces,
  inferDepartmentsFromPolygon,
  loadCommunes,
  loadCommunesFromEtalab,
  loadCommunesFromOverpassPolygon,
  loadMairieContact,
} from './scan_sources.ts';

const ploermelArea: AreaConfig = {
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-2.52, 47.93],
      [-2.30, 47.93],
      [-2.30, 47.80],
      [-2.52, 47.80],
      [-2.52, 47.93],
    ]],
  },
  population_max: 500,
  commerce_max: 2,
  max_candidates: 20,
};

const departmentsArea: AreaConfig = {
  department_codes: ['56'],
  population_max: 500,
  commerce_max: 2,
  max_candidates: 10,
};

async function main() {
  console.log('Deno smoke test - scan sources');

  console.log('\n1. Etalab fallback, department 56');
  const etalab = await loadCommunesFromEtalab(departmentsArea);
  console.log(`Etalab communes loaded: ${etalab.length}`);
  console.log(etalab.slice(0, 3));

  console.log('\n2. Department load with primary/fallback');
  const departmentCommunes = await loadCommunes('departments', departmentsArea);
  const smallCommunes = departmentCommunes
    .filter((commune) => typeof commune.population === 'number' && commune.population < 500)
    .slice(0, 5);
  console.log(`Department communes loaded: ${departmentCommunes.length}`);
  console.log('Small commune samples:', smallCommunes);

  console.log('\n3. Polygon department inference');
  console.log(inferDepartmentsFromPolygon(ploermelArea));

  console.log('\n4. Overpass polygon communes');
  try {
    const polygonCommunes = await loadCommunesFromOverpassPolygon(ploermelArea);
    console.log(`Overpass polygon communes loaded: ${polygonCommunes.length}`);
    console.log(polygonCommunes.slice(0, 5));
  } catch (err) {
    console.log(`Overpass polygon failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const candidate = smallCommunes[0] || etalab.find((commune) => commune.population && commune.population < 500);
  if (candidate) {
    console.log(`\n5. Commerce count for ${candidate.nom} (${candidate.code})`);
    try {
      const count = await countCommuneCommerces(candidate.code);
      console.log(`Commerce count: ${count}`);
    } catch (err) {
      console.log(`Commerce count failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log(`\n6. Mairie contact for ${candidate.nom} (${candidate.code})`);
    const mairie = await loadMairieContact(candidate.code);
    console.log(mairie);
  }
}

await main();
