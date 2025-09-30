/**
 * Script de test pour vérifier les limitations de l'API Plane.so
 * 
 * Ce script teste spécifiquement les fonctionnalités qui pourraient
 * ne pas être disponibles dans l'API Plane.so.
 */

// Configuration de test
const TEST_CONFIG = {
  PLANE_API_ENDPOINT: 'https://plane.provect.io',
  PLANE_API_KEY: 'your_api_key_here',
  PLANE_WORKSPACE_SLUG: 'your_workspace_slug',
  TEST_PROJECT_NAME: 'Test Limitations Project',
  TEST_MODULE_NAME: 'Test Limitations Module',
  TEST_TASK_NAME: 'Test Limitations Task',
  TEST_SUBTASK_NAME: 'Test Limitations Subtask'
};

// Fonction utilitaire pour les appels API
async function makeApiCall(endpoint, method = 'GET', body = null) {
  const url = `${TEST_CONFIG.PLANE_API_ENDPOINT}${endpoint}`;
  const options = {
    method,
    headers: {
      'x-api-key': TEST_CONFIG.PLANE_API_KEY,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: data,
      error: response.ok ? null : data
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

// Test 1: Vérifier l'archivage de projets
async function testProjectArchiving() {
  console.log('🔍 Test 1: Archivage de projets');
  console.log('─'.repeat(50));
  
  // Créer un projet de test
  const createResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/`,
    'POST',
    {
      name: TEST_CONFIG.TEST_PROJECT_NAME,
      identifier: 'test-limitations',
      description: 'Projet de test pour les limitations'
    }
  );
  
  if (!createResult.success) {
    console.log('❌ Impossible de créer le projet de test');
    console.log('   Erreur:', createResult.error);
    return false;
  }
  
  const projectId = createResult.data.id;
  console.log('✅ Projet créé:', projectId);
  
  // Tester l'archivage
  const archiveResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
    'PATCH',
    {
      archived_at: new Date().toISOString()
    }
  );
  
  if (archiveResult.success) {
    console.log('✅ Archivage de projet FONCTIONNE');
    console.log('   Données retournées:', archiveResult.data);
  } else {
    console.log('❌ Archivage de projet ÉCHOUÉ');
    console.log('   Statut:', archiveResult.status);
    console.log('   Erreur:', archiveResult.error);
  }
  
  // Nettoyer - supprimer le projet de test
  await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
    'DELETE'
  );
  
  console.log('');
  return archiveResult.success;
}

// Test 2: Vérifier les sous-tâches
async function testSubIssues() {
  console.log('🔍 Test 2: Sous-tâches (Sub-Issues)');
  console.log('─'.repeat(50));
  
  // Créer un projet de test
  const createProjectResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/`,
    'POST',
    {
      name: TEST_CONFIG.TEST_PROJECT_NAME,
      identifier: 'test-subissues',
      description: 'Projet de test pour les sous-tâches'
    }
  );
  
  if (!createProjectResult.success) {
    console.log('❌ Impossible de créer le projet de test');
    return false;
  }
  
  const projectId = createProjectResult.data.id;
  console.log('✅ Projet créé:', projectId);
  
  // Créer une tâche parent
  const createTaskResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
    'POST',
    {
      name: TEST_CONFIG.TEST_TASK_NAME,
      description: 'Tâche parent de test'
    }
  );
  
  if (!createTaskResult.success) {
    console.log('❌ Impossible de créer la tâche parent');
    return false;
  }
  
  const parentTaskId = createTaskResult.data.id;
  console.log('✅ Tâche parent créée:', parentTaskId);
  
  // Tester la création d'une sous-tâche
  const createSubTaskResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
    'POST',
    {
      name: TEST_CONFIG.TEST_SUBTASK_NAME,
      description: 'Sous-tâche de test',
      parent: parentTaskId
    }
  );
  
  if (createSubTaskResult.success) {
    console.log('✅ Création de sous-tâche FONCTIONNE');
    console.log('   Sous-tâche créée:', createSubTaskResult.data.id);
    console.log('   Parent:', createSubTaskResult.data.parent);
  } else {
    console.log('❌ Création de sous-tâche ÉCHOUÉ');
    console.log('   Statut:', createSubTaskResult.status);
    console.log('   Erreur:', createSubTaskResult.error);
  }
  
  // Nettoyer - supprimer le projet de test
  await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
    'DELETE'
  );
  
  console.log('');
  return createSubTaskResult.success;
}

// Test 3: Vérifier l'association issues-modules
async function testModuleIssueAssociation() {
  console.log('🔍 Test 3: Association Issues-Modules');
  console.log('─'.repeat(50));
  
  // Créer un projet de test
  const createProjectResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/`,
    'POST',
    {
      name: TEST_CONFIG.TEST_PROJECT_NAME,
      identifier: 'test-modules',
      description: 'Projet de test pour les modules'
    }
  );
  
  if (!createProjectResult.success) {
    console.log('❌ Impossible de créer le projet de test');
    return false;
  }
  
  const projectId = createProjectResult.data.id;
  console.log('✅ Projet créé:', projectId);
  
  // Créer un module
  const createModuleResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/`,
    'POST',
    {
      name: TEST_CONFIG.TEST_MODULE_NAME,
      description: 'Module de test'
    }
  );
  
  if (!createModuleResult.success) {
    console.log('❌ Impossible de créer le module de test');
    return false;
  }
  
  const moduleId = createModuleResult.data.id;
  console.log('✅ Module créé:', moduleId);
  
  // Créer une issue
  const createIssueResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
    'POST',
    {
      name: TEST_CONFIG.TEST_TASK_NAME,
      description: 'Issue de test'
    }
  );
  
  if (!createIssueResult.success) {
    console.log('❌ Impossible de créer l\'issue de test');
    return false;
  }
  
  const issueId = createIssueResult.data.id;
  console.log('✅ Issue créée:', issueId);
  
  // Tester l'association issue-module
  const associateResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/${moduleId}/module-issues/`,
    'POST',
    {
      issues: [issueId]
    }
  );
  
  if (associateResult.success) {
    console.log('✅ Association issue-module FONCTIONNE');
    console.log('   Données retournées:', associateResult.data);
  } else {
    console.log('❌ Association issue-module ÉCHOUÉ');
    console.log('   Statut:', associateResult.status);
    console.log('   Erreur:', associateResult.error);
    
    // Tester l'alternative avec le champ module
    console.log('🔄 Test de l\'alternative avec le champ module...');
    const updateIssueResult = await makeApiCall(
      `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issueId}/`,
      'PATCH',
      {
        module: moduleId
      }
    );
    
    if (updateIssueResult.success) {
      console.log('✅ Alternative avec champ module FONCTIONNE');
    } else {
      console.log('❌ Alternative avec champ module ÉCHOUÉ');
      console.log('   Erreur:', updateIssueResult.error);
    }
  }
  
  // Nettoyer - supprimer le projet de test
  await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
    'DELETE'
  );
  
  console.log('');
  return associateResult.success;
}

// Test 4: Vérifier les champs disponibles pour les issues
async function testIssueFields() {
  console.log('🔍 Test 4: Champs disponibles pour les issues');
  console.log('─'.repeat(50));
  
  // Créer un projet de test
  const createProjectResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/`,
    'POST',
    {
      name: TEST_CONFIG.TEST_PROJECT_NAME,
      identifier: 'test-fields',
      description: 'Projet de test pour les champs'
    }
  );
  
  if (!createProjectResult.success) {
    console.log('❌ Impossible de créer le projet de test');
    return false;
  }
  
  const projectId = createProjectResult.data.id;
  console.log('✅ Projet créé:', projectId);
  
  // Créer une issue avec tous les champs possibles
  const issueData = {
    name: TEST_CONFIG.TEST_TASK_NAME,
    description: 'Issue de test avec tous les champs',
    description_html: '<p>Issue de test avec tous les champs</p>',
    state: 'backlog',
    priority: 'low',
    assignees: [],
    labels: [],
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +7 jours
    parent: null, // Test du champ parent
    module: null, // Test du champ module
    estimate_point: 5,
    start_date: new Date().toISOString().split('T')[0],
    target_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // +14 jours
  };
  
  const createIssueResult = await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
    'POST',
    issueData
  );
  
  if (createIssueResult.success) {
    console.log('✅ Création d\'issue avec champs étendus FONCTIONNE');
    console.log('   Champs acceptés:', Object.keys(createIssueResult.data));
    
    // Afficher les champs disponibles
    const availableFields = Object.keys(createIssueResult.data);
    console.log('📋 Champs disponibles dans la réponse:');
    availableFields.forEach(field => {
      console.log(`   - ${field}: ${typeof createIssueResult.data[field]}`);
    });
  } else {
    console.log('❌ Création d\'issue avec champs étendus ÉCHOUÉ');
    console.log('   Statut:', createIssueResult.status);
    console.log('   Erreur:', createIssueResult.error);
  }
  
  // Nettoyer - supprimer le projet de test
  await makeApiCall(
    `/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
    'DELETE'
  );
  
  console.log('');
  return createIssueResult.success;
}

// Fonction principale
async function runLimitationTests() {
  console.log('🚀 Tests des Limitations API Plane.so');
  console.log('═'.repeat(60));
  console.log('');
  
  const results = {
    projectArchiving: false,
    subIssues: false,
    moduleIssueAssociation: false,
    issueFields: false
  };
  
  // Exécuter tous les tests
  results.projectArchiving = await testProjectArchiving();
  results.subIssues = await testSubIssues();
  results.moduleIssueAssociation = await testModuleIssueAssociation();
  results.issueFields = await testIssueFields();
  
  // Résumé des résultats
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('═'.repeat(60));
  console.log(`Archivage de projets: ${results.projectArchiving ? '✅ FONCTIONNE' : '❌ ÉCHOUÉ'}`);
  console.log(`Sous-tâches: ${results.subIssues ? '✅ FONCTIONNE' : '❌ ÉCHOUÉ'}`);
  console.log(`Association issues-modules: ${results.moduleIssueAssociation ? '✅ FONCTIONNE' : '❌ ÉCHOUÉ'}`);
  console.log(`Champs étendus issues: ${results.issueFields ? '✅ FONCTIONNE' : '❌ ÉCHOUÉ'}`);
  
  const successCount = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log('');
  console.log(`🎯 Résultat global: ${successCount}/${totalTests} tests réussis`);
  
  if (successCount === totalTests) {
    console.log('🎉 Toutes les fonctionnalités testées fonctionnent !');
  } else {
    console.log('⚠️  Certaines fonctionnalités nécessitent des adaptations');
    console.log('📖 Consultez le rapport API_LIMITATIONS_REPORT.md pour plus de détails');
  }
  
  return results;
}

// Instructions d'utilisation
console.log('📖 Instructions d\'utilisation :');
console.log('1. Modifiez la configuration TEST_CONFIG avec vos paramètres Plane.so');
console.log('2. Exécutez ce script avec : node test-api-limitations.js');
console.log('3. Analysez les résultats pour identifier les limitations');
console.log('\n⚠️  Attention : Ce script créera des éléments de test dans votre workspace Plane.so');
console.log('');

// Exécuter les tests si le script est lancé directement
if (require.main === module) {
  runLimitationTests().catch(console.error);
}

module.exports = {
  testProjectArchiving,
  testSubIssues,
  testModuleIssueAssociation,
  testIssueFields,
  runLimitationTests
};
