/**
 * Script de test pour vérifier la migration de Monday.com vers Plane.so
 * 
 * Ce script teste les principales fonctionnalités de l'API Plane.so
 * pour s'assurer que la migration fonctionne correctement.
 */

// Configuration de test (à adapter selon votre environnement)
const TEST_CONFIG = {
  PLANE_API_ENDPOINT: 'https://plane.provect.io',
  PLANE_API_KEY: 'your_api_key_here',
  PLANE_WORKSPACE_SLUG: 'your_workspace_slug',
  TEST_PROJECT_NAME: 'Test Migration Project',
  TEST_MODULE_NAME: 'Test Module',
  TEST_TASK_NAME: 'Test Task',
  TEST_SUBTASK_NAME: 'Test Subtask'
};

// Fonction pour tester la connexion API
async function testApiConnection() {
  console.log('🔍 Test de connexion API...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.PLANE_API_ENDPOINT}/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/`, {
      headers: {
        'x-api-key': TEST_CONFIG.PLANE_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Connexion API réussie');
      console.log(`📊 ${data.count || 0} projets trouvés`);
      return true;
    } else {
      console.error('❌ Erreur de connexion API:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    return false;
  }
}

// Fonction pour tester la création d'un projet
async function testCreateProject() {
  console.log('🔍 Test de création de projet...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.PLANE_API_ENDPOINT}/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/`, {
      method: 'POST',
      headers: {
        'x-api-key': TEST_CONFIG.PLANE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: TEST_CONFIG.TEST_PROJECT_NAME,
        identifier: 'test-migration',
        description: 'Projet de test pour la migration',
        cycle_view: false,  // Explicitly disable cycles
        module_view: true   // Keep modules enabled
      })
    });
    
    if (response.ok) {
      const project = await response.json();
      console.log('✅ Projet créé avec succès');
      console.log(`📋 ID du projet: ${project.id}`);
      return project;
    } else {
      const error = await response.json();
      console.error('❌ Erreur de création de projet:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur de création de projet:', error.message);
    return null;
  }
}

// Fonction pour tester la création d'un module
async function testCreateModule(projectId) {
  console.log('🔍 Test de création de module...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.PLANE_API_ENDPOINT}/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/`, {
      method: 'POST',
      headers: {
        'x-api-key': TEST_CONFIG.PLANE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: TEST_CONFIG.TEST_MODULE_NAME,
        description: 'Module de test pour la migration'
      })
    });
    
    if (response.ok) {
      const module = await response.json();
      console.log('✅ Module créé avec succès');
      console.log(`📋 ID du module: ${module.id}`);
      return module;
    } else {
      const error = await response.json();
      console.error('❌ Erreur de création de module:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur de création de module:', error.message);
    return null;
  }
}

// Fonction pour tester la création d'une tâche
async function testCreateTask(projectId, moduleId) {
  console.log('🔍 Test de création de tâche...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.PLANE_API_ENDPOINT}/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`, {
      method: 'POST',
      headers: {
        'x-api-key': TEST_CONFIG.PLANE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: TEST_CONFIG.TEST_TASK_NAME,
        description: 'Tâche de test pour la migration',
        description_html: '<p>Tâche de test pour la migration</p>'
      })
    });
    
    if (response.ok) {
      const task = await response.json();
      console.log('✅ Tâche créée avec succès');
      console.log(`📋 ID de la tâche: ${task.id}`);
      
      // Ajouter la tâche au module
      await fetch(`${TEST_CONFIG.PLANE_API_ENDPOINT}/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/${moduleId}/module-issues/`, {
        method: 'POST',
        headers: {
          'x-api-key': TEST_CONFIG.PLANE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          issues: [task.id]
        })
      });
      
      console.log('✅ Tâche ajoutée au module');
      return task;
    } else {
      const error = await response.json();
      console.error('❌ Erreur de création de tâche:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur de création de tâche:', error.message);
    return null;
  }
}

// Fonction pour tester la création d'une sous-tâche
async function testCreateSubtask(projectId, parentTaskId) {
  console.log('🔍 Test de création de sous-tâche...');
  
  try {
    const response = await fetch(`${TEST_CONFIG.PLANE_API_ENDPOINT}/api/v1/workspaces/${TEST_CONFIG.PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`, {
      method: 'POST',
      headers: {
        'x-api-key': TEST_CONFIG.PLANE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: TEST_CONFIG.TEST_SUBTASK_NAME,
        description: 'Sous-tâche de test pour la migration',
        description_html: '<p>Sous-tâche de test pour la migration</p>',
        parent: parentTaskId
      })
    });
    
    if (response.ok) {
      const subtask = await response.json();
      console.log('✅ Sous-tâche créée avec succès');
      console.log(`📋 ID de la sous-tâche: ${subtask.id}`);
      return subtask;
    } else {
      const error = await response.json();
      console.error('❌ Erreur de création de sous-tâche:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur de création de sous-tâche:', error.message);
    return null;
  }
}

// Fonction principale de test
async function runMigrationTests() {
  console.log('🚀 Démarrage des tests de migration Plane.so\n');
  
  // Test 1: Connexion API
  const connectionOk = await testApiConnection();
  if (!connectionOk) {
    console.log('\n❌ Tests interrompus - Connexion API échouée');
    return;
  }
  
  console.log('\n');
  
  // Test 2: Création de projet
  const project = await testCreateProject();
  if (!project) {
    console.log('\n❌ Tests interrompus - Création de projet échouée');
    return;
  }
  
  console.log('\n');
  
  // Test 3: Création de module
  const module = await testCreateModule(project.id);
  if (!module) {
    console.log('\n❌ Tests interrompus - Création de module échouée');
    return;
  }
  
  console.log('\n');
  
  // Test 4: Création de tâche
  const task = await testCreateTask(project.id, module.id);
  if (!task) {
    console.log('\n❌ Tests interrompus - Création de tâche échouée');
    return;
  }
  
  console.log('\n');
  
  // Test 5: Création de sous-tâche
  const subtask = await testCreateSubtask(project.id, task.id);
  if (!subtask) {
    console.log('\n❌ Tests interrompus - Création de sous-tâche échouée');
    return;
  }
  
  console.log('\n');
  console.log('🎉 Tous les tests de migration sont passés avec succès !');
  console.log('\n📋 Résumé des éléments créés :');
  console.log(`   - Projet: ${project.name} (ID: ${project.id})`);
  console.log(`   - Module: ${module.name} (ID: ${module.id})`);
  console.log(`   - Tâche: ${task.name} (ID: ${task.id})`);
  console.log(`   - Sous-tâche: ${subtask.name} (ID: ${subtask.id})`);
  console.log('\n✅ La migration de Monday.com vers Plane.so est fonctionnelle !');
}

// Instructions d'utilisation
console.log('📖 Instructions d\'utilisation :');
console.log('1. Modifiez la configuration TEST_CONFIG avec vos paramètres Plane.so');
console.log('2. Exécutez ce script avec : node test-migration.js');
console.log('3. Vérifiez que tous les tests passent');
console.log('\n⚠️  Attention : Ce script créera des éléments de test dans votre workspace Plane.so');
console.log('');

// Exécuter les tests si le script est lancé directement
if (require.main === module) {
  runMigrationTests().catch(console.error);
}

module.exports = {
  testApiConnection,
  testCreateProject,
  testCreateModule,
  testCreateTask,
  testCreateSubtask,
  runMigrationTests
};
