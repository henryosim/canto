"use strict";

/*global history,curs_root_uri,angular,$,make_ontology_complete_url,
  ferret_choose,application_root,window,canto_root_uri,curs_key,
  app_static_path,loadingStart,loadingEnd,alert,trim */

var canto = angular.module('cantoApp', ['ui.bootstrap', 'angular-confirm', 'toaster',
                                        'chart.js']);

canto.config(['$compileProvider', function ($compileProvider) {
  $compileProvider.debugInfoEnabled(false);
}]);

canto.config(['ChartJsProvider', function (ChartJsProvider) {
  ChartJsProvider.setOptions({ chartColors : [
      '#90A0CD', // blue
      '#BCBCBC', // light grey
      '#F7464A', // red
      '#46BFBD', // green
      '#FDB45C', // yellow
      '#949FB1', // grey
      '#4D5360'  // dark grey
  ]});
}]);

function capitalizeFirstLetter(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function countKeys(o) {
  var size = 0, key;
  for (key in o) {
    if (o.hasOwnProperty(key)) {
      if (key.indexOf('$$') !== 0) {
        size++;
      }
    }
  }
  return size;
}

function arrayRemoveOne(array, item) {
  var i = array.indexOf(item);
  if (i >= 0) {
    array.splice(i, 1);
  }
}

function copyObject(src, dest, keysFilter) {
  Object.getOwnPropertyNames(src).forEach(function(key) {
    if (key.indexOf('$$') === 0) {
      // ignore AngularJS data
      return;
    }
    if (keysFilter) {
      if (!keysFilter[key]) {
        return;
      }
    }

    if (null == src[key] || "object" != typeof src[key]) {
      dest[key] = src[key];
      return;
    }

    if (src[key] instanceof Array) {
      dest[key] = [];
      var len = src[key].length;
      var i;
      for (i = 0; i < len; i++) {
        dest[key][i] = src[key][i];
      }
      return;
    }

    if (src[key] instanceof Object) {
      dest[key] = {};
      copyObject(src[key], dest[key]);
    }
  });
}

// for each property in changedObj, copy to dest when it's different to origObj
function copyIfChanged(origObj, changedObj, dest) {
  Object.getOwnPropertyNames(changedObj).forEach(function(key) {
    if ((typeof(changedObj[key]) == 'undefined' || changedObj[key] == null) &&
        (typeof(origObj[key]) == 'undefined' || origObj[key] == null)) {
      return;
    }

    if (changedObj[key] !== origObj[key]) {
      if (origObj[key] instanceof Array && changedObj[key] instanceof Array &&
          angular.equals(origObj[key], changedObj[key])) {
        // same
      } else {
        dest[key] = changedObj[key];
      }
    }
  });
}

function simpleHttpPost(toaster, $http, url, data) {
  loadingStart();
  var promise = $http.post(url, data);
  promise.success(function(data) {
      if (data.status === "success") {
        window.location.href = data.location;
      } else {
        toaster.pop('error', data.message);
      }
    }).
    error(function(data, status){
      var message;
      if (status == 404) {
        message = "Internal error: " + status;
      } else {
        "Accessing server failed: " + (data || status)
      }
      toaster.pop('error', message);
    }).
    finally(function() {
      loadingEnd();
    });

  return promise;
}

function conditionsToString(conditions) {
  return $.map(conditions, function(el) { return el.name; }).join (", ");
}

function conditionsToStringHighlightNew(conditions) {
  return $.map(conditions, function(el) {
    if (el.term_id) {
      return el.name;
    } else {
      return '<span style="color: red;">' + el.name + '</span>';
    }
  }).join (", ");
}


canto.filter('breakExtensions', function() {
  return function(text) {
    if (text) {
      return text.replace(/,/g, ', ').replace(/\|/, " | ");
    }
    return '';
  };
});

canto.filter('toTrusted', ['$sce', function($sce){
  return function(text) {
    return $sce.trustAsHtml(text);
  };
}]);

canto.filter('addZeroWidthSpace', function () {
  return function (item) {
    if (item == null) {
      return null;
    }
    return item.replace(/,/g, ',&#8203;');
  };
});

canto.filter('wrapAtSpaces', function () {
  return function (item) {
    if (item == null) {
      return null;
    }
    return item.replace(/(\S+)/g, '<span style="white-space: nowrap">$1</span>');
  };
});

canto.filter('encodeAlleleSymbols', function () {
  return function (item) {
    if (item == null) {
      return null;
    }
    return item.replace(/delta/g, '&Delta;');
  };
});

canto.filter('featureChooserFilter', function () {
  return function (feature) {
    var ret = feature.display_name;
    if (feature.background) {
      ret += "  (bkg: " + feature.background.substr(0, 15);
      if (feature.background.length > 15) {
        ret += " ...";
      }
      ret += ")"
    }
    return ret;
  };
});

canto.config(function($logProvider){
    $logProvider.debugEnabled(true);
});

function makeRangeScopeForRequest(rangeScope) {
  if ($.isArray(rangeScope)) {
    return '[' + rangeScope.join('|') + ']';
  }
  // special case for using the ontology namespace instead of
  // restricting to a subset using a term or terms
  return rangeScope;
}

canto.service('Curs', function($http, $q) {
  this.list = function(key, args) {
    var data = null;

    if (!args) {
      args = [];
    }

    var url = curs_root_uri + '/ws/' + key + '/list/';

    if (args.length > 0 && typeof(args[args.length - 1]) === 'object') {
      data = args.pop();
      return $http.post(url + args.join('/'), data);
    }
    // force IE not to cache
    var unique = '?u=' + (new Date()).getTime();
    return $http.get(url + args.join('/') + unique);
  };

  this.details = function(key, args) {
    var data = null;

    if (!args) {
      args = [];
    }

    var url = curs_root_uri + '/ws/' + key + '/details/';

    if (args.length > 0 && typeof(args[args.length - 1]) === 'object') {
      data = args.pop();
      return $http.post(url + args.join('/'), data);
    }
    var unique = '?u=' + (new Date()).getTime();
    return $http.get(url + args.join('/') + unique);
  };

  this.add = function(key, args) {
    if (!args) {
      args = [];
    }

    var url = curs_root_uri + '/ws/' + key + '/add/' + args.join('/');
    return $http.get(url);
  };

  this.delete = function(objectType, objectId) {
    var q = $q.defer();

    // POST the curs_key so that a crawled GET can't delete a feature
    // the key is checked on the server
    var details = { key: curs_key };

    var putQ = $http.put(curs_root_uri + '/ws/' + objectType + '/delete/' + objectId,
                        details);

    putQ.success(function(response) {
      if (response.status === 'success') {
        q.resolve();
      } else {
        q.reject(response.message);
      }
    }).error(function(data, status) {
      q.reject('Deletion request failed: ' + status);
    });

    return q.promise;
  };
});

canto.service('CursGeneList', function($q, Curs) {
  this.geneList = function() {
    var q = $q.defer();

    Curs.list('gene').success(function(genes) {
      $.map(genes,
            function(gene) {
              gene.feature_id = gene.gene_id;
            });
      q.resolve(genes);
    }).error(function() {
      q.reject();
    });

    return q.promise;
  };
});

canto.service('CursGenotypeList', function($q, Curs) {
  function add_id_or_identifier(genotypes) {
    $.map(genotypes, function(genotype) {
      genotype.id_or_identifier = genotype.genotype_id || genotype.identifier;
      genotype.feature_id = genotype.genotype_id;
    });
  }

  this.cursGenotypeList = function(options) {
    var q = $q.defer();

    var cursGenotypesPromise = Curs.list('genotype', ['curs_only', options ]);

    cursGenotypesPromise.success(function(genotypes) {
      add_id_or_identifier(genotypes);
      q.resolve(genotypes);
    }).error(function(data, status) {
      if (status) {
        q.reject();
      } // otherwise the request was cancelled
    });

    return q.promise;
  };

  this.filteredGenotypeList = function(cursOrAll, filter) {
    var options = {
      filter: filter,
      include_allele: 1,
    };
    var filteredCursPromise =
      Curs.list('genotype', [cursOrAll, options]);

    var q = $q.defer();

    filteredCursPromise.success(function(genotypes) {
      add_id_or_identifier(genotypes);
      q.resolve(genotypes);
    }).error(function(data, status) {
      if (status) {
        q.reject();
      } // otherwise the request was cancelled
    });

    return q.promise;
  };

  this.deleteGenotype = function(genotypeList, genotypeId) {
    var q = $q.defer();

    Curs.delete('genotype', genotypeId)
      .then(function() {
        for (var i = 0; i < genotypeList.length; i++) {
          if (genotypeList[i].genotype_id == genotypeId) {
            genotypeList.splice(i, 1);
            break;
          }
        }
        q.resolve();
      })
      .catch(function(message) {
        q.reject(message);
      });

    return q.promise;
  };
});

canto.service('CursAlleleList', function($q, Curs) {
  this.alleleList = function(genePrimaryIdentifier, searchTerm) {
    var q = $q.defer();

    Curs.list('allele', [genePrimaryIdentifier, searchTerm])
      .success(function(alleles) {
        q.resolve(alleles);
      })
      .error(function() {
        q.reject();
      });

    return q.promise;
  };
});

canto.service('CursConditionList', function($q, Curs) {
  this.conditionList = function() {
    var q = $q.defer();

    Curs.list('condition').success(function(conditions) {
      q.resolve(conditions);
    }).error(function() {
      q.reject();
    });

    return q.promise;
  };
});

canto.service('CursSessionDetails', function(Curs) {
  this.promise = Curs.details('session');

  this.get = function() {
    return this.promise;
  };
});

canto.service('CantoGlobals', function($window) {
  this.app_static_path = $window.app_static_path;
  this.application_root = $window.application_root;
  this.curs_root_uri = $window.curs_root_uri;
  this.ferret_choose = $window.ferret_choose;
  this.read_only_curs = $window.read_only_curs;
  this.is_admin_session = $window.is_admin_session;
  this.is_admin_user = $window.is_admin_user;
  this.current_user_is_admin = $window.current_user_is_admin;
  this.curationStatusData = $window.curationStatusData;
  this.cumulativeAnnotationTypeCounts = $window.cumulativeAnnotationTypeCounts;
  this.perPub5YearStatsData = $window.perPub5YearStatsData;
});

canto.service('CantoService', function($http) {
  this.lookup = function(key, path_parts, params, timeout) {
    return $http.get(application_root + '/ws/lookup/' + key + '/' +
                     path_parts.join('/'),
                     {
                       params: params,
                       timeout: timeout
                     });
  };

  this.details = function(key, params, timeout) {
    return $http.get(application_root + '/ws/details/' + key,
                     {
                       params: params,
                       timeout: timeout
                     });

  };
});

var keysForServer = {
  extension: true,
  annotation_type: true,
  evidence_code: true,
  conditions: true,
  feature_id: true,
  feature_type: true,
//  is_not: true,
  qualifiers: true,
  submitter_comment: true,
  term_ontid: true,
  term_suggestion_name: true,
  term_suggestion_definition: true,
  with_gene_id: true,
  interacting_gene_id: true,
};

var annotationProxy =
  function(Curs, $q, $http) {
    var proxy = this;
    this.allQs = {};
    this.annotationsByType = {};

    this.getAnnotation = function(annotationTypeName) {
      if (!proxy.allQs[annotationTypeName]) {
        var q = $q.defer();
        proxy.allQs[annotationTypeName] = q.promise;

        var cursQ = Curs.list('annotation', [annotationTypeName]);

        cursQ.success(function(annotations) {
          proxy.annotationsByType[annotationTypeName] = annotations;
          q.resolve(annotations);
        });

        cursQ.error(function(data, status) {
          if (status) {
            q.reject();
          } // otherwise the request was cancelled
        });
      }

      return proxy.allQs[annotationTypeName];
    };

    this.deleteAnnotation = function(annotation) {
      var q = $q.defer();

      var details = { key: curs_key,
                      annotation_id: annotation.annotation_id };

      var putQ = $http.put(curs_root_uri + '/ws/annotation/delete', details);

      putQ.success(function(response) {
        if (response.status === 'success') {
          var annotations = proxy.annotationsByType[annotation.annotation_type];
          if (annotations) {
            var index = annotations.indexOf(annotation);
            if (index >= 0) {
              annotations.splice(index, 1);
            }
          }
          q.resolve();
        } else {
          q.reject(response.message);
        }
      }).error(function(data, status) {
        q.reject('Deletion request failed: ' + status);
      });

      return q.promise;
    };

  this.storeChanges = function(annotation, changes, newly_added) {
    var q = $q.defer();

    var changesToStore = {};

    if (newly_added) {
      // special case, copy everything
      copyObject(changes, changesToStore, keysForServer);
    } else {
      copyIfChanged(annotation, changes, changesToStore);

      if (countKeys(changesToStore) === 0) {
        q.reject('No changes to store');
        return q.promise;
      }

      if (changesToStore.feature_id) {
        changesToStore.feature_type = annotation.feature_type;
      }
    }

    changesToStore.key = curs_key;

    // we send term_ontid, so this is not needed
    delete changesToStore.term_name;

    var putQ;

    if (newly_added) {
      putQ = $http.put(curs_root_uri + '/ws/annotation/create', changesToStore);
    } else {
      putQ = $http.put(curs_root_uri + '/ws/annotation/' + annotation.annotation_id +
                       '/new/change', changesToStore);
    }
    putQ.success(function(response) {
      if (response.status === 'success') {
        // update local copy
        copyObject(response.annotation, annotation);
        if (newly_added) {
          var annotations = proxy.annotationsByType[annotation.annotation_type];
          if (!annotations) {
            proxy.annotationsByType[annotation.annotation_type] = [];
            annotations = proxy.annotationsByType[annotation.annotation_type];
          }
          annotations.push(annotation);
        }
        q.resolve(annotation);
      } else {
        q.reject(response.message);
      }
    }).error(function() {
      q.reject();
    });

    return q.promise;
  };
};

canto.service('AnnotationProxy', ['Curs', '$q', '$http', annotationProxy]);

function fetch_conditions(search, showChoices) {
  $.ajax({
    url: make_ontology_complete_url('phenotype_condition'),
    data: { term: search.term, def: 1, },
    dataType: "json",
    success: function(data) {
      var choices = $.map( data, function( item ) {
        var label;
        if (typeof(item.matching_synonym) === 'undefined') {
          label = item.name;
        } else {
          label = item.matching_synonym + ' (synonym)';
        }
        return {
          label: label,
          value: item.name,
          name: item.name,
          definition: item.definition,
        };
      });
      showChoices(choices);
    },
  });
}

var cursStateService =
  function() {
    // var gene = null

    this.searchString = null;
    this.termHistory = [];
    this.extension = [];
    this.comment = null;
    this.state = 'searching';
    this.evidence_code = '';
    this.conditions = [];
    this.with_gene_id = null;
    this.validEvidence = false;
    this.comment = null;

    // return the data in a obj with keys keys suitable for sending to the
    // server
    this.asAnnotationDetails = function() {
      var retVal = {
        term_ontid: this.currentTerm(),
        evidence_code: this.evidence_code,
        with_gene_id: this.with_gene_id,
        conditions: this.conditions,
        term_suggestion_name: null,
        term_suggestion_definition: null,
        extension: this.extension,
        submitter_comment: this.comment,
      };

      if (this.termSuggestion) {
        retVal.term_suggestion_name = this.termSuggestion.name;
        retVal.term_suggestion_definition = this.termSuggestion.definition;
      }

      return retVal;
    };

    // clear the term picked by the term-name-complete and clear the history
    // of child terms we've navigated to
    this.clearTerm = function() {
      this.matchingSynonym = null;
      this.termHistory = [];
    };

    this.addTerm = function(termId) {
      this.termHistory.push(termId);
    };

    this.currentTerm = function() {
      if (this.termHistory.length > 0) {
        return this.termHistory[this.termHistory.length - 1];
      }
      return null;
    };

    this.gotoTerm = function(termId) {
      var i, value;
      for (i = 0; i < this.termHistory.length; i++) {
        value = this.termHistory[i];
        if (termId == value) {
          // truncate the array, making term_id the last element
          this.termHistory.length = i + 1;
          break;
        }
      }
    };

    this.setState = function(state) {
      this.state = state;
    };

    this.getState = function() {
      return this.state;
    };
  };

canto.service('CursStateService', ['$q', 'CantoService', cursStateService]);


var cursSettingsService =
  function($http, $timeout, $q) {
    var service = this;

    this.data = {
    };

    this.getAll = function() {
      if (typeof(curs_root_uri) == 'undefined') {
        return {
          then: function (successCallback, errorCallback) {
            if (typeof(errorCallback) != 'undefined') {
              errorCallback();
            }
          },
        };
      }
      var unique = '?u=' + (new Date()).getTime();
      return $http.get(curs_root_uri + '/ws/settings/get_all' + unique);
    };

    this.set = function(key, value) {
      var q = $q.defer();

      var unique = '?u=' + (new Date()).getTime();
      var getRes = $http.get(curs_root_uri + '/ws/settings/set/' + key + '/' + value + unique);

      getRes.success(function(result) {
        if (result.status == 'success') {
          service.data[key] = value;
          q.resolve();
        } else {
          q.reject(result.message);
        }
      }).error(function(data, status) {
        q.reject('request failed: ' + status);
      });

      return q.promise;
    };

    service.getAll().then(function(response) {
      $timeout(function() {
        service.data.annotation_mode = response.data.annotation_mode;
      });
    });

    this.getAnnotationMode = function() {
      return service.data.annotation_mode;
    };

    this.setAnnotationMode = function(mode) {
      service.set('annotation_mode', mode);
    };

    this.setAdvancedMode = function() {
      return service.setAnnotationMode('advanced');
    };

    this.setStandardMode = function() {
      return service.setAnnotationMode('standard');
    };
  };

canto.service('CursSettings', ['$http', '$timeout', '$q', cursSettingsService]);


var cursAnnotationDataService =
  function($http) {
    var service = this;

    service.set = function(annotationId, key, value) {
      var unique = '?u=' + (new Date()).getTime();
      var url = curs_root_uri + '/ws/annotation/data/set/' + annotationId + '/' +
          key + '/' + value + unique;
      return $http.get(url);
    };
  };

canto.service('CursAnnotationDataService', ['$http', cursAnnotationDataService]);


var helpIcon = function(CantoGlobals, CantoConfig) {
  return {
    scope: {
      key: '@',
    },
    restrict: 'E',
    replace: true,
    templateUrl: app_static_path + 'ng_templates/help_icon.html',
    controller: function($scope) {
      $scope.helpText = null;

      $scope.app_static_path = CantoGlobals.app_static_path;

      $scope.click = function() {
        if ($scope.url) {
          window.open($scope.url, '_blank');
        }
      };

      CantoConfig.get('help_text').success(function(results) {
        if (results[$scope.key]) {
          if (results[$scope.key].docs_path) {
            $scope.url = CantoGlobals.application_root + '/docs/' + results[$scope.key].docs_path;
          }
          if (results[$scope.key].inline) {
            $scope.helpText = results[$scope.key].inline;
            if ($scope.url) {
              $scope.helpText += " (Click to visit documentation)";
            }
          }
        }
      });
    },
  };
};

canto.directive('helpIcon', ['CantoGlobals', 'CantoConfig', helpIcon]);


function openSimpleDialog($uibModal, title, heading, message)
{
  return $uibModal.open({
    templateUrl: app_static_path + 'ng_templates/simple_dialog.html',
    controller: 'SimpleDialogCtrl',
    title: title,
    resolve: {
      args: function() {
        return {
          heading: heading,
          message: message,
        };
      },
    },
    animate: false,
    windowClass: "modal",
    backdrop: 'static',
  });
}

var cursFrontPageCtrl =
  function($scope, CursSettings, CursAnnotationDataService) {
    $scope.checkAll = function() {
      CursAnnotationDataService.set('all', 'checked', 'yes').
        success(function() {
          window.location.reload(false);
        });
    };
    $scope.clearAll = function() {
      CursAnnotationDataService.set('all', 'checked', 'no').
        success(function() {
          window.location.reload(false);
        });
    };

    $scope.getAnnotationMode = function() {
      return CursSettings.getAnnotationMode();
    };
  };

canto.controller('CursFrontPageCtrl',
                 ['$scope', 'CursSettings', 'CursAnnotationDataService', cursFrontPageCtrl]);


var simpleDialogCtrl =
  function($scope, $uibModalInstance, args) {
    $scope.message = args.message;

    $scope.close = function () {
      $uibModalInstance.dismiss('close');
    };
  };

canto.controller('SimpleDialogCtrl',
                 ['$scope', '$uibModalInstance', 'args', simpleDialogCtrl]);


var pubmedIdStart =
  function($http, toaster, CantoGlobals, CantoConfig) {
    return {
      scope: {
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/pubmed_id_start.html',
      controller: function($scope) {
        $scope.data = {
          searchId: null,
          results: null,
        };
        $scope.userIsAdmin = CantoGlobals.current_user_is_admin;
        CantoConfig.get('public_mode')
          .then(function(results) {
            $scope.publicMode = results.data.value != "0";
          });

        $scope.search = function() {
          loadingStart();
          var url =
            CantoGlobals.application_root +
              'tools/pubmed_id_lookup?pubmed-id-lookup-input=' + $scope.data.searchId;
          var promise = $http.post(url);
          promise.
            success(function(results) {
              if (results.message) {
                toaster.pop('error', results.message);
              } else {
                $scope.data.results = results;
              }
            }).
            error(function(data, status){
              var message;
              if (status == 404) {
                message = "Internal error: " + status;
              } else {
                message = "Accessing server failed: " + (data || status);
              }
              toaster.pop('error', message);
            }).
            finally(function() {
              loadingEnd();
            });
        };
 
        $scope.findAnother = function() {
          $scope.data.results = null;
        };

        $scope.startCuration = function() {
          loadingStart();
          if ($scope.data.results.sessions.length > 0) {
            if ($scope.publicMode) {
              window.location.href =
                CantoGlobals.application_root + 'curs/' + $scope.data.results.sessions[0];
            } else {
              window.location.href =
                CantoGlobals.application_root + 'curs/' + $scope.data.results.sessions[0] + '/ro';
            }
          } else {
            window.location.href =
              CantoGlobals.application_root + 'tools/start/' + $scope.data.results.pub.uniquename;
          }
        };
     }
    };
  };

canto.directive('pubmedIdStart',
                ['$http', 'toaster', 'CantoGlobals', 'CantoConfig', pubmedIdStart]);


var advancedModeToggle =
  function(CursSettings) {
    return {
      scope: {
      },
      restrict: 'E',
      replace: true,
      template: '<label ng-click="$event.stopPropagation()"><input ng-change="change()" ng-model="advanced" type="checkbox"/>Advanced mode</label>',
      controller: function($scope) {
        $scope.CursSettings = CursSettings;

        $scope.advanced = CursSettings.getAnnotationMode() == 'advanced';

        $scope.$watch('CursSettings.getAnnotationMode()',
                      function(newValue) {
                        $scope.advanced = newValue == 'advanced';
                      });

        $scope.change = function() {
          if ($scope.advanced) {
            CursSettings.setAdvancedMode();
          } else {
            CursSettings.setStandardMode();
          }
        };
      }
    };
  };

canto.directive('advancedModeToggle', ['CursSettings', advancedModeToggle]);


var breadcrumbsDirective =
  function($compile, CursStateService, CantoService) {
    return {
      scope: {
      },
      restrict: 'E',
      replace: true,
      controller: function($scope) {
        $scope.CursStateService = CursStateService;

        $scope.termDetails = {};

        $scope.clearTerms = function() {
          CursStateService.clearTerm();
        };

        $scope.gotoTerm = function(termId) {
          CursStateService.gotoTerm(termId);
        };

        $scope.currentTerm = function() {
          return CursStateService.currentTerm();
        };

        $scope.lookupPromise = function(termId) {
          return CantoService.lookup('ontology', [termId],
                                     {
                                       def: 1,
                                     });
        };

        $scope.lookupProcess = function(data) {
          if (!data.children || data.children.length == 0) {
            data.children = null;
          }
          if (!data.synonyms || data.synonyms.length == 0) {
            data.synonyms = null;
          } else {
            data.synonyms = $.map(data.synonyms,
                                  function(synonym) {
                                    return synonym.name;
                                  });
          }

          $scope.termDetails[data.id] = data;

          $scope.render();
        };

        $scope.render = function() {
          var html = '';

          var i, termId, termDetails, makeLink, termText;
          var termHistory = CursStateService.termHistory;
          for (i = 0; i < termHistory.length; i++) {
            termId = termHistory[i];
            makeLink = (i != termHistory.length - 1);

            html += '<div class="breadcrumbs-link">';

            termDetails = $scope.termDetails[termId];
            if (termDetails) {
              termText = termId + ' - ' + termDetails.name;
            } else {
              termText = termId;
            }

            if (makeLink) {
              html += '<a href="#" ng-click="' +
                "gotoTerm('" + termId + "'" + ')">';
            }

            html += '<initially-hidden-text text="' + termText + 
              '" link-label="..." preview-char-count="40"></initially-hidden-text>';

            if (makeLink) {
              html += '</a>';
            }
          }

          for (i = 0; i < termHistory.length; i++) {
            html += '</div>';
          }

          $('#breadcrumb-terms').html($compile(html)($scope));
        };
      },
      link: function($scope) {
        $scope.$watch('currentTerm()',
                      function(newTermId) {
                        if (newTermId) {
                          if (!$scope.termDetails[newTermId]) {
                            $scope.lookupPromise(newTermId).then(function(result) {
                              $scope.lookupProcess(result.data);
                            });
                          }
                        }

                        $scope.render();
                      });

      },
      templateUrl: app_static_path + 'ng_templates/breadcrumbs.html',
    };
  };

canto.directive('breadcrumbs', ['$compile', 'CursStateService', 'CantoService',
                                breadcrumbsDirective]);


function openSingleGeneAddDialog($uibModal)
{
  return $uibModal.open({
    templateUrl: app_static_path + 'ng_templates/single_gene_add.html',
    controller: 'SingleGeneAddDialogCtrl',
    title: 'Add a new gene by name or identifier',
    animate: false,
    windowClass: "modal",
    backdrop: 'static',
  });
}


function featureChooserControlHelper($scope, $uibModal, CursGeneList,
                                     CursGenotypeList, toaster) {
  function getGenesFromServer() {
    CursGeneList.geneList().then(function(results) {
      $scope.features = results;
    }).catch(function() {
      toaster.pop('note', "couldn't read the gene list from the server");
    });
  }

  if ($scope.featureType === 'gene') {
    getGenesFromServer();
  } else {
    CursGenotypeList.cursGenotypeList().then(function(results) {
      $scope.features = results;
    }).catch(function() {
      toaster.pop('note', "couldn't read the genotype list from the server");
    });
  }

  $scope.openSingleGeneAddDialog = function() {
    var modal = openSingleGeneAddDialog($uibModal);
    modal.result.then(function () {
      getGenesFromServer();
    });
  };

  if ($scope.chosenFeatureUniquename !== undefined ||
      $scope.chosenFeatureDisplayName !== undefined) {
    $scope.$watch('chosenFeatureId',
                  function(newFeatureId) {
                    if (newFeatureId && $scope.features) {
                      $.map($scope.features,
                            function(feature) {
                              if (feature.feature_id === newFeatureId) {
                                if ($scope.chosenFeatureUniquename !== undefined) {
                                  $scope.chosenFeatureUniquename = feature.primary_identifier;
                                }
                                if ($scope.chosenFeatureDisplayName !== undefined) {
                                  $scope.chosenFeatureDisplayName = feature.display_name;
                                }
                              }
                            });
                    }
                  });
  }
}


var multiFeatureChooser =
  function($uibModal, CursGeneList, CursGenotypeList, toaster) {
    return {
      scope: {
        featureType: '@',
        selectedFeatureIds: '=',
      },
      restrict: 'E',
      replace: true,
      controller: function($scope) {
        featureChooserControlHelper($scope, $uibModal, CursGeneList,
                                    CursGenotypeList, toaster);

        $scope.toggleSelection = function toggleSelection(featureId) {
          var idx = $scope.selectedFeatureIds.indexOf(featureId);

          // is currently selected
          if (idx > -1) {
            $scope.selectedFeatureIds.splice(idx, 1);
          }

          // is newly selected
          else {
            $scope.selectedFeatureIds.push(featureId);
          }
        };
      },
      templateUrl: app_static_path + 'ng_templates/multi_feature_chooser.html',
    };
  };

canto.directive('multiFeatureChooser',
                ['$uibModal', 'CursGeneList', 'CursGenotypeList', 'toaster',
                 multiFeatureChooser]);


var featureChooser =
  function($uibModal, CursGeneList, CursGenotypeList, toaster) {
    return {
      scope: {
        featureType: '@',
        chosenFeatureId: '=',
        chosenFeatureUniquename: '=',
        chosenFeatureDisplayName: '=',
      },
      restrict: 'E',
      replace: true,
      controller: function($scope) {
        featureChooserControlHelper($scope, $uibModal, CursGeneList, CursGenotypeList,
                                    toaster);
      },
      templateUrl: app_static_path + 'ng_templates/feature_chooser.html',
    };
  };

canto.directive('featureChooser',
                ['$uibModal', 'CursGeneList', 'CursGenotypeList', 'toaster',
                 featureChooser]);


var ontologyTermSelect =
  function() {
    return {
      scope: {
        annotationType: '=',
        termFoundCallback: '&',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/ontology_term_select.html',
      controller: function($scope) {
        $scope.foundCallback = function(termId, termName, searchString, matchingSynonym) {
          $scope.termFoundCallback({ termId: termId,
                                     termName: termName,
                                     searchString: searchString,
                                     matchingSynonym: matchingSynonym,
                                   });
        };
      },
      link: function() {
        $('#loading').unbind('.canto');
        $('#ferret-term-input').attr('disabled', false);
      },
    };
  };

canto.directive('ontologyTermSelect', [ontologyTermSelect]);


var externalTermLinks =
  function(CantoService, CantoConfig) {
    return {
      scope: {
        termId: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/external_term_links.html',
      controller: function($scope) {
        $scope.processExternalLinks = function(linkConfig, newTermId) {
          var link_confs = linkConfig[$scope.termDetails.annotation_namespace];
          if (link_confs) {
            var html = '';
            $.each(link_confs, function(idx, link_conf) {
              var url = link_conf.url;
              // hacky: allow a substitution like WebUtil::substitute_paths()
              var re = new RegExp("@@term_ont_id(?::s/(.+)/(.*)/r)?@@");
              url = url.replace(re,
                                function(match_str, p1, p2) {
                                  if (!p1 || p1.length == 0) {
                                    return newTermId;
                                  }
                                  return newTermId.replace(new RegExp(p1), p2);
                                });
              var img_src =
                  application_root + 'static/images/logos/' +
                  link_conf.icon;
              var title = 'View in: ' + link_conf.name;
              html += '<div class="curs-external-link"><a target="_blank" href="' +
                url + '" title="' + title + '">';
              if (img_src) {
                html += '<img alt="' + title + '" src="' + img_src + '"/></a>';
              } else {
                html += title;
              }
              var link_img_src = application_root + 'static/images/ext_link.png';
              html += '<img src="' + link_img_src + '"/></div>';
            });
            var $linkouts = $('.curs-term-linkouts');
            if (html.length > 0) {
              $linkouts.find('.curs-term-linkout-target').html(html);
              $linkouts.show();
            } else {
              $linkouts.hide();
            }
          }
        };

        $scope.$watch('termId',
                      function(newTermId) {
                        if (!newTermId) {
                          return;
                        }

                        CantoService.lookup('ontology', [newTermId],
                                            {
                                              def: 1,
                                            })
                          .then(function(details) {
                            $scope.termDetails = details.data;

                            return CantoConfig.get('ontology_external_links');
                          })
                          .then(function(results) {
                            $scope.processExternalLinks(results.data, newTermId);
                          });
                    });

      },
    };
  };

canto.directive('externalTermLinks',
                ['CantoService', 'CantoConfig', externalTermLinks]);


var ontologyTermConfirm =
  function($uibModal, toaster, CantoService, CantoConfig, CantoGlobals) {
    return {
      scope: {
        annotationType: '=',
        featureDisplayName: '@',
        termId: '@',
        matchingSynonym: '@',
        gotoChildCallback: '&',
        unsetTermCallback: '&',
        suggestTermCallback: '&',
        confirmTermCallback: '&',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/ontology_term_confirm.html',
      controller: function($scope) {
        $scope.synonymTypes = [];

        $scope.$watch('annotationType.name',
                      function(typeName) {
                        if (typeName) {
                          $scope.synonymTypes = $scope.annotationType.synonyms_to_display;
                        }
                      });

        $scope.app_static_path = CantoGlobals.app_static_path;

        $scope.$watch('termId',
                      function(newTermId) {
                        if (newTermId) {
                          CantoService.lookup('ontology', [newTermId],
                                              {
                                                def: 1,
                                                children: 1,
                                                synonyms: $scope.synonymTypes,
                                              })
                            .then(function(response) {
                              $scope.termDetails = response.data;
                            });
                        } else {
                          $scope.termDetails = null;
                        }
                      });

        $scope.gotoChild = function(childId) {
          $scope.gotoChildCallback({ childId: childId });
        };

        $scope.unsetTerm = function() {
          $scope.unsetTermCallback();
        };
        $scope.suggestTerm = function(termSuggestion) {
          $scope.suggestTermCallback({termSuggestion: termSuggestion});
        };
        $scope.confirmTerm = function() {
          $scope.confirmTermCallback();
        };

        $scope.openTermSuggestDialog =
          function(featureDisplayName) {
            var suggestInstance = $uibModal.open({
              templateUrl: app_static_path + 'ng_templates/term_suggest.html',
              controller: 'TermSuggestDialogCtrl',
              title: 'Suggest a new term for ' + featureDisplayName,
              animate: false,
              windowClass: "modal",
              backdrop: 'static',
            });

            suggestInstance.result.then(function (termSuggestion) {
              $scope.suggestTerm(termSuggestion);

              toaster.pop('note',
                          'Your term suggestion will be stored, but ' +
                          featureDisplayName + ' will be temporarily ' +
                          'annotated with the parent of your suggested new term',
                          null, 20000);
            });
          };
      },
    };
  };


canto.directive('ontologyTermConfirm',
                ['$uibModal', 'toaster', 'CantoService', 'CantoConfig', 'CantoGlobals',
                 ontologyTermConfirm]);


var ontologyTermCommentTransfer =
  function() {
    return {
      scope: {
        annotationType: '=',
        featureType: '@',
        featureDisplayName: '@',
        annotationDetails: '=',
        comment: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/ontology_term_comment_transfer.html',
    };
  };

canto.directive('ontologyTermCommentTransfer',
                ['CantoService', ontologyTermCommentTransfer]);


function openExtensionRelationDialog($uibModal, extensionRelation, relationConfig) {
  return $uibModal.open({
    templateUrl: app_static_path + 'ng_templates/extension_relation_dialog.html',
    controller: 'ExtensionRelationDialogCtrl',
    title: 'Edit extension relation',
    animate: false,
    windowClass: "modal",
    resolve: {
      args: function() {
        return {
          extensionRelation: extensionRelation,
          relationConfig: relationConfig,
        };
      },
    },
    backdrop: 'static',
  }).result;
}

function arrayIntersection(arr1, arr2) {
  var intersect = [];
 
  $.map(arr1,
        function(el) {
          if ($.inArray(el, arr2) != -1) {
            intersect.push(el);
          }
        });

  return intersect;
}


// Filter the extension_configuration results from the server and return
// only those where the "domain" term ID in the configuration matches one of
// subsetIds.  Also ignore any configs where the "role" is "admin" and the
// current, logged in user isn't an admin.
function extensionConfFilter(allConfigs, subsetIds, role) {
  return $.map(allConfigs,
               function(conf) {
                 if (conf.role == 'admin' &&
                     role != 'admin') {
                   return;
                 }
                 var matched =
                   $.grep(conf.subset_rel,
                          function(rel) {
                            return $.inArray(rel + "(" + conf.domain + ")", subsetIds) != -1;
                          }).length > 0;
                 if (matched) {
                   if (!conf.exclude_subset_ids ||
                       arrayIntersection(conf.exclude_subset_ids,
                                         subsetIds).length == 0) {
                     return {
                       displayText: conf.display_text,
                       relation: conf.allowed_relation,
                       domain: conf.domain,
                       role: conf.role,
                       range: conf.range,
                       rangeValue: null,
                       cardinality: conf.cardinality,
                     };
                   }
                 }
               });
}


var extensionBuilderDialogCtrl =
  function($scope, $uibModalInstance, args) {
    $scope.data = args;
    $scope.extensionBuilderIsValid = false;

    $scope.ok = function () {
      $uibModalInstance.close({
        extension: $scope.data.extension,
      });
    };

    $scope.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };
  };

canto.controller('ExtensionBuilderDialogCtrl',
                 ['$scope', '$uibModalInstance', 'args',
                 extensionBuilderDialogCtrl]);


function openExtensionBuilderDialog($uibModal, extension, termId, featureDisplayName) {
  return $uibModal.open({
    templateUrl: app_static_path + 'ng_templates/extension_builder_dialog.html',
    controller: 'ExtensionBuilderDialogCtrl',
    title: 'Edit extension',
    animate: false,
    windowClass: "modal",
    resolve: {
      args: function() {
        return {
          extension: angular.copy(extension),
          termId: termId,
          featureDisplayName: featureDisplayName,
        };
      },
    },
    backdrop: 'static',
  }).result;
}


function extensionAsString(extension) {
  return $.map(extension,
               function(orPart) {
                 return $.map(orPart,
                              function (andPart) {
                                return andPart.relation + '(' + andPart.rangeValue + ')';
                              }).join(', ');
               }).join('| ');
}

function parseExtensionAndPart(orPart) {
  orPart = orPart.trim();
  if (orPart.length == 0) {
    return {
      error: null,
      parsedPart: [],
    };
  }
  var split = orPart.split(/,/);
  var i, part, matchResult;
  var parsedPart = [];
  for (i = 0; i < split.length; i++) {
    part = split[i];
    matchResult = part.match(/^\s*(\S+?)\s*\(\s*([^\)]+?)\s*\)/);
    if (matchResult && matchResult.length == 3) {
      parsedPart.push({
        relation: matchResult[1],
        rangeValue: matchResult[2],
        rangeDisplayName: matchResult[2],
      });
    } else {
      return {
        error: 'String "' + part + '" cannot be parsed',
        parsedPart: null,
      };
    }
  }

  return {
    error: null,
    parsedPart: parsedPart,
  };
}


function parseExtensionString(extensionString) {
  extensionString = extensionString.trim();
  if (extensionString.length == 0) {
    return {
      error: null,
      extension: [],
    };
  }
  var orParts = extensionString.split(/\|/);
  var i;
  var extension = [];
  for (i = 0; i < orParts.length; i++) {
    var result = parseExtensionAndPart(orParts[i]);

    if (result.error) {
      return result;
    }

    extension.push(result.parsedPart);
  }

  return {
    error: null,
    extension: extension,
  };
}

var extensionManualEditDialogCtrl =
  function($scope, $uibModalInstance, args) {
    $scope.currentError = "";

    $scope.editExtension =
      $.map(args.extension,
            function(part) {
              var newPart = {};
              copyObject(part, newPart);
              return newPart;
            });

    $scope.isValid = function() {
      return $scope.currentError.length == 0;
    };

    $scope.ok = function () {
      $uibModalInstance.close({
        extension: $scope.editExtension,
      });
    };

    $scope.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };
  };

canto.controller('ExtensionManualEditDialogCtrl',
                 ['$scope', '$uibModalInstance', 'args',
                  extensionManualEditDialogCtrl]);


function openExtensionManualEditDialog($uibModal, extension, matchingConfigurations) {
  return $uibModal.open({
    templateUrl: app_static_path + 'ng_templates/extension_manual_edit_dialog.html',
    controller: 'ExtensionManualEditDialogCtrl',
    title: 'Edit extension as text',
    animate: false,
    windowClass: "modal",
    resolve: {
      args: function() {
        return {
          extension: extension,
          matchingConfigurations: matchingConfigurations,
        };
      },
    },
    backdrop: 'static',
  }).result;
}


var extensionManualEdit =
  function() {
    return {
      scope: {
        extension: '=',
        currentError: '=',
        matchingConfigurations: '=',
      },
      restrict: 'E',
      replace: true,
      template: '<div> <textarea ng-model="text" rows="4" cols="65"></textarea> </div>',
      link: function($scope) {
        $scope.currentError = "";
        $scope.text = extensionAsString($scope.extension);

        $scope.$watch('text',
                      function() {
                        var result = parseExtensionString($scope.text);

                        if (result.error) {
                          $scope.currentError = result.error;
                        } else {
                          $scope.currentError = "";
                          $scope.extension = result.extension;
                        }
                      });
      },
    };
  };

canto.directive('extensionManualEdit',
                [extensionManualEdit]);


var extensionOrGroupBuilder =
  function($uibModal, $q, CantoGlobals, CantoConfig, CantoService) {
    return {
      scope: {
        orGroup: '=',
        matchingConfigurations: '=',
        isValid: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/extension_or_group_builder.html',
      controller: function($scope) {
        $scope.isValid = true;
        $scope.currentUserIsAdmin = CantoGlobals.current_user_is_admin;
        $scope.manualEditMode = false;

        // the current counts of relations, used to test the cardinality
        // constraints
        $scope.cardinalityCounts = null;

        $scope.makeCountKey = function(extensionRelConf) {
          return extensionRelConf.relation + '-' +
            $.map(extensionRelConf.range,
                  function(part) {
                    var ret = part.type;
                    if (part.type == 'Ontology') {
                      ret += '-' + part.scope.join(';');
                    }
                    return ret;
                  }).join('|');
        };

        $scope.checkCardinality = function(matchingConfigurations) {
          var newCounts = {};
          var promises = [];

          $scope.cardinalityCounts = null;

          if (!matchingConfigurations) {
            return;
          }

          $.map(matchingConfigurations,
                function(relConf) {
                  var incrementNewCounts =
                    function() {
                      var key = $scope.makeCountKey(relConf);
                      if (newCounts[key]) {
                        newCounts[key]++;
                      } else {
                        newCounts[key] = 1;
                      }
                    };
                  $.map($scope.orGroup,
                        function(part) {
                          var matchingRangeConf = null;
                          $.map(relConf.range,
                                function(rangeConf) {
                                  if (rangeConf.type == part.rangeType) {
                                    matchingRangeConf = rangeConf;
                                  }
                                });

                          if (!matchingRangeConf) {
                            return;
                          }

                          if (part.relation == relConf.relation) {
                            if (matchingRangeConf.type == 'Ontology') {
                              var promise =
                                CantoService.lookup('ontology', [part.rangeValue],
                                                    {
                                                      subset_ids: 1,
                                                    })
                                  .then(function(response) {
                                    var isInSubset = false;
                                    response.data.subset_ids.filter(function(subset_id) {
                                      if (matchingRangeConf.scope.indexOf(subset_id) != -1) {
                                        isInSubset = true;
                                      }
                                    });
                                    if (isInSubset) {
                                      incrementNewCounts(relConf);
                                    }
                                  });

                              promises.push(promise);
                            } else {
                              incrementNewCounts(relConf);
                            }
                          }
                        });
                });

          $q.all(promises).then(function() {
            $scope.cardinalityCounts = newCounts;
          });
        };

        $scope.getCardinalityCount = function(extensionRelConf) {
          if ($scope.cardinalityCounts) {
            return $scope.cardinalityCounts[$scope.makeCountKey(extensionRelConf)] || 0;
          }

          return 0;
        };

        $scope.cardinalityStatus = function(extensionRelConf) {
          var count = $scope.getCardinalityCount(extensionRelConf);
          var cardinalityConf = extensionRelConf.cardinality;

          if (cardinalityConf.length == 1) {
            if (cardinalityConf[0] == '*') {
              return 'MORE_POSSIBLE';
            }

            if (cardinalityConf[0] == count) {
              return 'MAX_REACHED';
            }

            return 'MORE_REQUIRED';
          }

          if (cardinalityConf.length == 2) {
            if ((cardinalityConf[0] == 0 &&
                 cardinalityConf[1] == 1) ||
                (cardinalityConf[1] == 0 &&
                 cardinalityConf[0] == 1)) {
              if (count == 1) {
                return 'MAX_REACHED';
              }
              // fall through
            }
            // fall through
          }

          return 'MORE_POSSIBLE';
        };

        $scope.setIsValid = function() {
          $scope.isValid = true;

          if ($scope.matchingConfigurations) {
            $.map($scope.matchingConfigurations,
                  function(relConf) {
                    if ($scope.cardinalityStatus(relConf) == 'MORE_REQUIRED') {
                      $scope.isValid = false;
                    }
                  });
          }
        };

        $scope.$watch('orGroup',
                      function() {
                        $scope.checkCardinality($scope.matchingConfigurations);
                      }, true);

        $scope.$watch('matchingConfigurations',
                      function() {
                        $scope.checkCardinality($scope.matchingConfigurations);
                      }, true);

        $scope.$watch('cardinalityCounts',
                      function() {
                        $scope.setIsValid();
                      }, true);

        $scope.startAddRelation = function(relationConfig) {
          var editExtensionRelation = {
            relation: relationConfig.relation,
            rangeDisplayName: '',
          };

          var editPromise =
            openExtensionRelationDialog($uibModal, editExtensionRelation, relationConfig);

          editPromise.then(function(result) {
            $scope.orGroup.push(result.extensionRelation);
          });
        };
      },
    };
  };

canto.directive('extensionOrGroupBuilder',
                ['$uibModal', '$q', 'CantoGlobals', 'CantoConfig', 'CantoService',
                 extensionOrGroupBuilder]);

function extensionIsEmpty(extension) {
  if (extension) {
    if (extension.length == 0 ||
        extension.length == 1 && extension[0].length == 0) {
      return false;
    }

    return true;
  }

  return false;
}

var extensionBuilder =
  function($uibModal, $q, CantoGlobals, CantoConfig, CantoService) {
    return {
      scope: {
        extension: '=',
        termId: '@',
        featureDisplayName: '@',
        isValid: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/extension_builder.html',
      controller: function($scope) {
        $scope.isValid = true;
        $scope.currentUserIsAdmin = CantoGlobals.current_user_is_admin;
        $scope.manualEditMode = false;
        $scope.matchingConfigurations = [];

        if (!$scope.extension || $scope.extension.length == 0) {
          $scope.extension = [[]];
        }

        $scope.isNewExtension = extensionIsEmpty($scope.extension);

        $scope.extensionConfiguration = [];
        $scope.termDetails = { id: null };

        $scope.updateMatchingConfig = function() {
          var subset_ids = $scope.termDetails.subset_ids;

          if ($scope.extensionConfiguration.length > 0 &&
              subset_ids && subset_ids.length > 0) {
            var newConf =
              extensionConfFilter($scope.extensionConfiguration, subset_ids,
                                  CantoGlobals.current_user_is_admin ? 'admin' : 'user');
            copyObject(newConf, $scope.matchingConfigurations);
            return;
          }

          $scope.matchingConfigurations = [];
        };

        $scope.$watch('termId',
                      function(newTermId) {
                        if (newTermId) {
                          CantoService.lookup('ontology', [newTermId],
                                              {
                                                subset_ids: 1,
                                              })
                            .then(function(response) {
                              $scope.termDetails = response.data;
                              CantoConfig.get('extension_configuration')
                                .then(function(results) {
                                  $scope.extensionConfiguration = results.data;
                                  $scope.updateMatchingConfig();
                                });
                            });
                          return;
                        }
                        $scope.termDetails = { id: null };
                    });

        $scope.addOrGroup = function() {
          if ($scope.extension[$scope.extension.length - 1].length != 0) {
            $scope.extension.push([]);
          }
        };

        $scope.manualEdit = function() {
          var editPromise =
            openExtensionManualEditDialog($uibModal, $scope.extension, $scope.matchingConfigurations);

          editPromise.then(function(result) {
            $scope.extension = result.extension;
          });
        };

        $scope.debugConfText = function(conf) {
          if ($scope.currentUserIsAdmin) {
            return "domain: " + conf.domain + "\nrole: " + conf.role +
              "\nrange: " + JSON.stringify(conf.range, null, 2);
          } else {
            return "";
          }
        };
      },
    };
  };

canto.directive('extensionBuilder',
                ['$uibModal', '$q', 'CantoGlobals', 'CantoConfig', 'CantoService',
                 extensionBuilder]);


var extensionRelationDialogCtrl =
  function($scope, $uibModalInstance, args) {
    $scope.data = args;
    $scope.extensionRelation = args.extensionRelation;
    $scope.relationConfig = args.relationConfig;
    $scope.selected = {
      rangeType: $scope.relationConfig.range[0].type,
    };
    $scope.extensionRelation.rangeType = $scope.selected.rangeType;

    $scope.isValid = function() {
      return !!$scope.data.extensionRelation.rangeValue;
    };

    $scope.$watch('selected',
                  function() {
                    $scope.extensionRelation.rangeType = $scope.selected.rangeType;
                  }, true);

    $scope.ok = function () {
      if ($scope.extensionRelation.rangeType == '%') {
        $scope.extensionRelation.rangeValue =
          $scope.extensionRelation.rangeValue.replace(/%\s*$/, '');
      }
      $uibModalInstance.close({
        extensionRelation: $scope.extensionRelation,
      });
    };

    $scope.finishedCallback = function() {
      $scope.ok();
    }

    $scope.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };
  };

canto.controller('ExtensionRelationDialogCtrl',
                 ['$scope', '$uibModalInstance', 'args',
                 extensionRelationDialogCtrl]);

function openTermConfirmDialog($uibModal, termId, initialState, featureType)
{
  return $uibModal.open({
    templateUrl: app_static_path + 'ng_templates/term_confirm.html',
    controller: 'TermConfirmDialogCtrl',
    title: 'Confirm term',
    animate: false,
    windowClass: "modal",
    size: 'lg',
    resolve: {
      args: function() {
        return {
          termId: termId,
          initialState: initialState,
          featureType: featureType,
        };
      }
    },
    backdrop: 'static',
  });
}


var extensionRelationEdit =
  function(CantoService, CursGeneList, toaster, $uibModal) {
    return {
      scope: {
        extensionRelation: '=',
        relationConfig: '=',
        rangeConfig: '=',
        disabled: '=',
        finishedCallback: '&',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/extension_relation_edit.html',
      controller: function($scope) {
        $scope.rangeGeneId = '';

        $scope.disableAll = function(element, disabled) {
          $(element).find('input').attr('disabled', disabled);
          $(element).find('select').attr('disabled', disabled);
        };

        $scope.termFoundCallback = function(termId, termName, searchString) {
          $scope.extensionRelation.rangeValue = termId;
          $scope.extensionRelation.rangeDisplayName = termName;

          if (searchString && !searchString.match(/^".*"$/) && searchString !== termId) {
            var termConfirm = openTermConfirmDialog($uibModal, termId);

            termConfirm.result.then(function(result) {
              $scope.extensionRelation.rangeValue = result.newTermId;
              $scope.extensionRelation.rangeDisplayName = result.newTermName;
              $scope.finishedCallback();
            });
          } // else: user pasted a term ID or user quoted the search - skip confirmation
        };
 
        if ($scope.rangeConfig.type == 'Gene') {
          if ($scope.extensionRelation.rangeValue) {
            // editing existing part
            CursGeneList.geneList().then(function(results) {
              //
            }).catch(function() {
              toaster.pop('note', "couldn't read the gene list from the server");
            });
          } else {
            $scope.extensionRelation.rangeValue = '';
          }
        }

        if ($scope.rangeConfig.type == 'Ontology') {
          var rangeScope = $scope.rangeConfig.scope;
          $scope.rangeOntologyScope =
            makeRangeScopeForRequest(rangeScope);

          if ($scope.extensionRelation.rangeValue) {
          // editing existing extension part
          CantoService.lookup('ontology', [$scope.extensionRelation.rangeValue], {})
            .success(function(data) {
              $scope.extensionRelation.rangeDisplayName = data.name;
            });
          }
        }

        $scope.valueIsValid = function() {
          if ($scope.rangeConfig.type == '%') {
            return $scope.percentParseMessage().length == 0;
          } else {
            return true;
          }
        }

        $scope.percentParseMessage = function() {
          if ($scope.disabled) {
            return '';
          }

          if ($scope.rangeConfig.type == '%') {
            var rangeValue = $scope.extensionRelation.rangeValue;

            if (typeof(rangeValue) == 'undefined' || trim(rangeValue).length == 0) {
              return "Required";
            }

            var re = new RegExp(/^\s*(\d+|\d+\.\d*|\d*\.\d+)(?:-(\d+|\d+\.\d*|\d*\.\d+))?\s*\%?$/);
            var result = re.exec($scope.extensionRelation.rangeValue);

            if (result) {
              var pcStart = result[1];

              if (pcStart > 100) {
                return 'Value must be <= 100';
              }

              if (result.length > 2) {
                var pcEnd = result[2];
                if (+pcEnd < +pcStart) {
                  return "start of range greater than end: " +
                    pcStart + ">" + pcEnd;
                }

                return '';
              }
            } else {
              return 'Value must be a percentage, e.g. 45%';
            }
          } else {
            return '';
          }
        };
      },
      link: function($scope, elem) {
        $scope.$watch('disabled',
                      function() {
                        $scope.disableAll(elem, $scope.disabled);
                        $scope.extensionRelation.rangeValue = '';
                      }
              );
      }
    };
  };

canto.directive('extensionRelationEdit',
                ['CantoService', 'CursGeneList', 'toaster', '$uibModal',
                 extensionRelationEdit]);


var extensionDisplay =
  function(CantoGlobals) {
    return {
      scope: {
        extension: '=',
        showDelete: '@',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/extension_display.html',
      controller: function($scope) {
        $scope.app_static_path = CantoGlobals.app_static_path;
      },
    };
  };

canto.directive('extensionDisplay', ['CantoGlobals', extensionDisplay]);


var extensionOrGroupDisplay =
  function(CantoGlobals, CantoService) {
    return {
      scope: {
        extension: '=',
        orGroup: '=',
        showDelete: '@',
        editable: '@',
        isFirst: '@',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/extension_or_group_display.html',
      controller: function($scope) {
        $scope.app_static_path = CantoGlobals.app_static_path;

        $.map($scope.orGroup,
              function(andGroup) {
                if (!andGroup.rangeType && andGroup.rangeValue.match('^[A-Z_]+:\\d+') ||
                    andGroup.rangeType && andGroup.rangeType == 'Ontology') {
                  CantoService.lookup('ontology', [andGroup.rangeValue], {})
                    .then(function(result) {
                      andGroup.rangeDisplayName = result.data.name;
                    });
                }
              });

        $scope.deleteAndGroup = function(andGroup) {
          if ($scope.showDelete) {
            arrayRemoveOne($scope.orGroup, andGroup);
            if ($scope.orGroup.length == 0 && $scope.extension.length > 1) {
              arrayRemoveOne($scope.extension, $scope.orGroup);
            }
          }
        };
      },
    };
  };

canto.directive('extensionOrGroupDisplay',
                ['CantoGlobals', 'CantoService', extensionOrGroupDisplay]);


var ontologyWorkflowCtrl =
  function($scope, toaster, $http, CantoGlobals, AnnotationTypeConfig, CantoService,
           CantoConfig, CursStateService, $attrs) {
    $scope.states = ['searching', 'selectingEvidence', 'buildExtension', 'commenting'];

    CursStateService.setState($scope.states[0]);
    $scope.annotationForServer = null;
    $scope.data = CursStateService;
    $scope.annotationTypeName = $attrs.annotationTypeName;

    $scope.extensionBuilderReady = false;
    $scope.matchingExtensionConfigs = null;

    $scope.showConditions = false;

    $scope.extensionBuilderIsValid = true;

    $scope.updateMatchingConfig = function() {
      var subset_ids = $scope.termDetails.subset_ids;

      if (subset_ids && subset_ids.length > 0) {
        $scope.matchingExtensionConfigs = 
          extensionConfFilter($scope.extensionConfiguration, subset_ids,
                              CantoGlobals.current_user_is_admin ? 'admin' : 'user');
        return;
      }

      $scope.matchingExtensionConfigs = [];
    };

    $scope.termFoundCallback =
      function(termId, termName, searchString, matchingSynonym) {
        CursStateService.clearTerm();
        CursStateService.addTerm(termId);
        CursStateService.searchString = searchString;
        CursStateService.matchingSynonym = matchingSynonym;

        $scope.matchingExtensionConfigs = null;

        CantoService.lookup('ontology', [termId],
                            {
                              subset_ids: 1,
                            })
                          .then(function(response) {
                            $scope.termDetails = response.data;
                            CantoConfig.get('extension_configuration')
                              .then(function(results) {
                                $scope.extensionConfiguration = results.data;
                                $scope.updateMatchingConfig();
                              });
                          });
      };

    $scope.gotoChild = function(termId) {
      CursStateService.addTerm(termId);
    };

    $scope.matchingSynonym = function () {
      return CursStateService.matchingSynonym;
    };

    $scope.getState = function() {
      return CursStateService.getState();
    };

    $scope.suggestTerm = function(suggestion) {
      CursStateService.termSuggestion = suggestion;

      $scope.gotoNextState();
    };

    $scope.gotoPrevState = function() {
      CursStateService.setState($scope.prevState());
    };

    $scope.gotoNextState = function() {
      CursStateService.setState($scope.nextState());
    };

    $scope.back = function() {
      if ($scope.getState() == 'searching') {
        CursStateService.clearTerm();
        $scope.extensionBuilderReady = false;
        return;
      }

      if ($scope.getState() == 'commenting') {
        if ($scope.matchingExtensionConfigs &&
            $scope.matchingExtensionConfigs.length == 0) {
          CursStateService.setState('selectingEvidence');
          return;
        }
      }

      $scope.gotoPrevState();
    };

    $scope.proceed = function() {
      if ($scope.getState() == 'commenting') {
        CursStateService.comment = $scope.data.comment;
        $scope.storeAnnotation();
        return;
      }

      if ($scope.getState() == 'selectingEvidence') {
        if ($scope.matchingExtensionConfigs &&
            $scope.matchingExtensionConfigs.length == 0) {
          CursStateService.setState('commenting');
          return;
        }
      }

      $scope.gotoNextState();
    };

    $scope.prevState = function() {
      var index = $scope.states.indexOf($scope.getState());

      if (index <= 0) {
        return null;
      }

      return $scope.states[index - 1];
    };

    $scope.nextState = function() {
      var index = $scope.states.indexOf($scope.getState());

      if (index == $scope.states.length - 1) {
        return null;
      }

      return $scope.states[index + 1];
    };

    $scope.$watch('getState()',
                  function(newState, oldState) {
                    if (newState == 'commenting') {
                      $scope.annotationForServer =
                        CursStateService.asAnnotationDetails();
                    } else {
                      $scope.annotationForServer = {};
                    }

                    if (oldState == 'selectingEvidence') {
                      CursStateService.evidence_code = $scope.data.evidence_code;
                      CursStateService.with_gene_id = $scope.data.with_gene_id;
                      CursStateService.conditions = $scope.data.conditions;
                    }
                  });

    $scope.currentTerm = function() {
      return CursStateService.currentTerm();
    };

    $scope.isValid = function() {
      if ($scope.getState() == 'selectingEvidence') {
        if ($scope.matchingExtensionConfigs == null) {
          return false;
        }
        return $scope.data.validEvidence;
      }

      if ($scope.getState() == 'buildExtension' &&
          !$scope.extensionBuilderIsValid) {
        return false;
      }

      return true;
    };

    $scope.storeAnnotation = function() {
      var storePop = toaster.pop({
        type: 'info',
        title: 'Storing annotation ...',
        timeout: 0, // last until page reload
        showCloseButton: false
      });

      var promise =
        simpleHttpPost(toaster, $http,
                       CantoGlobals.curs_root_uri + '/feature/' +
                       $scope.annotationType.feature_type + '/annotate/' +
                       $attrs.featureId + '/set_term/' + $scope.annotationType.name,
                     CursStateService.asAnnotationDetails());

      promise.finally(function() {
        toaster.clear(storePop);
      });
    };

    AnnotationTypeConfig.getByName($scope.annotationTypeName)
      .then(function(annotationType) {
        $scope.annotationType = annotationType;

        if (annotationType.feature_type == 'genotype') {
          $scope.backToFeatureUrl =
            CantoGlobals.curs_root_uri + '/genotype_manage' + 
            '#/select/' + $attrs.featureId;
        } else {
          $scope.backToFeatureUrl =
            CantoGlobals.curs_root_uri + '/feature/' + annotationType.feature_type +
            '/view/' + $attrs.featureId;
        }
      });
  };

canto.controller('OntologyWorkflowCtrl',
                 ['$scope', 'toaster', '$http', 'CantoGlobals',
                  'AnnotationTypeConfig', 'CantoService',
                  'CantoConfig', 'CursStateService', '$attrs',
                  ontologyWorkflowCtrl]);


var interactionWorkflowCtrl =
  function($scope, $http, toaster, $attrs) {

    $scope.annotationTypeName = $attrs.annotationTypeName;

    $scope.data = {
      validEvidence: false,
      evidenceConfirmed: false,
    };

    $scope.selectedFeatureIds = [];

    $scope.someFeaturesSelected = function() {
      return $scope.selectedFeatureIds.length > 0;
    };

    $scope.confirmEvidence = function() {
      $scope.data.evidenceConfirmed = true;
    };

    $scope.unconfirmEvidence = function() {
      $scope.data.evidenceConfirmed = false;
    };

    $scope.isValidEvidence = function() {
      return $scope.data.validEvidence;
    };

    $scope.backToGene = function() {
      history.go(-1);
    };

    $scope.addInteractionAndEvidence = function() {
      $scope.postInProgress = true;
      toaster.pop('info', 'Creating interaction ...');
      simpleHttpPost(toaster, $http, '../add_interaction/' + $scope.annotationTypeName,
                     {
                       evidence_code: $scope.data.evidence_code,
                       prey_gene_ids: $scope.selectedFeatureIds,
                     });
    };
  };

canto.controller('InteractionWorkflowCtrl',
                 ['$scope', '$http', 'toaster', '$attrs',
                  interactionWorkflowCtrl]);


var annotationEvidence =
  function(AnnotationTypeConfig, CantoConfig) {
    var directive = {
      scope: {
        evidenceCode: '=',
        showConditions: '=?',
        withGeneId: '=',
        validEvidence: '=', // true when evidence and with_gene_id are valid
        annotationTypeName: '@',
      },
      restrict: 'E',
      replace: true,
      controller: function($scope, $element, $attrs) {
        $scope.annotationType = null;
        $scope.evidenceCodes = [];

        AnnotationTypeConfig.getByName($scope.annotationTypeName)
          .then(function(annotationType) {
            $scope.annotationType = annotationType;
            $scope.evidenceCodes = annotationType.evidence_codes;
          });

        $scope.isValidEvidenceCode = function() {
          return $scope.evidenceCode && $scope.evidenceCode.length > 0 &&
            typeof($scope.evidenceTypes) != 'undefined' &&
            $scope.evidenceTypes[$scope.evidenceCode];
        };

        $scope.isValidWithGene = function() {
          return $scope.evidenceTypes && $scope.evidenceCode &&
            ($scope.evidenceTypes[$scope.evidenceCode] &&
             !$scope.evidenceTypes[$scope.evidenceCode].with_gene ||
             $scope.withGeneId);
        };

        $scope.showWith = function() {
          return $scope.evidenceTypes && $scope.isValidEvidenceCode() &&
            $scope.evidenceTypes[$scope.evidenceCode].with_gene;
        };

        $scope.isValidCodeAndWith = function() {
          return $scope.isValidEvidenceCode() && $scope.isValidWithGene();
        };

        $scope.validEvidence = $scope.isValidCodeAndWith();

        $scope.getDisplayCode = function(code) {
          if ($scope.evidenceTypes) {
            var name = $scope.evidenceTypes[code].name;
            if (name) {
              if (name.match('^' + code)) {
                return name;
              }
              return name + ' (' + code + ')';
            }
          }

          return code;
        };

        $scope.getDefinition = function(code) {
          if ($scope.evidenceTypes) {
            var def = $scope.evidenceTypes[code].definition;
            if (def) {
              return def;
            }
          }

          return $scope.getDisplayCode(code);
        };

        CantoConfig.get('evidence_types').success(function(results) {
          $scope.evidenceTypes = results;

          $scope.$watch('evidenceCode',
                        function() {
                          if (!$scope.isValidEvidenceCode() ||
                              !$scope.evidenceTypes[$scope.evidenceCode].with_gene) {
                            $scope.withGeneId = undefined;
                          }

                          $scope.validEvidence = $scope.isValidCodeAndWith();

                          if ("showConditions" in $attrs) {
                            $scope.showConditions =
                              $scope.isValidEvidenceCode() &&
                              $scope.annotationType && $scope.annotationType.can_have_conditions;
                          }
                        });

          $scope.validEvidence = $scope.isValidCodeAndWith();
        });

        $scope.$watch('withGeneId',
                      function() {
                        $scope.validEvidence = $scope.isValidCodeAndWith();
                      });

      },
      templateUrl: app_static_path + 'ng_templates/annotation_evidence.html'
    };
    return directive;
  };

canto.directive('annotationEvidence',
                ['AnnotationTypeConfig', 'CantoConfig', annotationEvidence]);

 var conditionPicker =
   function(CursConditionList, toaster) {
     var directive = {
       scope: {
         conditions: '=',
      },
      restrict: 'E',
      replace: true,
      controller: function($scope) {
        $scope.usedConditions = [];
        $scope.addCondition = function(condName) {
          // this hack stop apply() being called twice when user clicks an add
          // button
          setTimeout(function() {
            $scope.tagitList.tagit("createTag", condName);
          }, 1);
        };
      },
      templateUrl: app_static_path + 'ng_templates/condition_picker.html',
      link: function($scope, elem) {
        var $field = elem.find('.curs-allele-conditions');

        if (typeof($scope.conditions) != 'undefined') {
          CursConditionList.conditionList().then(function(results) {
            $scope.usedConditions = results;

            var updateScopeConditions = function() {
              // apply() is needed so the scope is update when a tag is added in
              // the Tagit field
              $scope.$apply(function() {
                $scope.conditions.length = 0;
                $field.find('li .tagit-label').map(function(index, $elem) {
                  $scope.conditions.push( { name: $elem.textContent.trim() } );
                });
              });
            };

            $field.tagit({
              minLength: 2,
              fieldName: 'curs-allele-condition-names',
              allowSpaces: true,
              placeholderText: 'Type a condition ...',
              tagSource: fetch_conditions,
              autocomplete: {
                focus: ferret_choose.show_autocomplete_def,
                close: ferret_choose.hide_autocomplete_def,
              },
            });
            $.map($scope.conditions,
                  function(cond) {
                    $field.tagit("createTag", cond.name);
                  });

            // don't start updating until all initial tags are added
            $field.tagit({
              afterTagAdded: updateScopeConditions,
              afterTagRemoved: updateScopeConditions,
            });

            $scope.tagitList = $field;
          }).catch(function() {
            toaster.pop('error', "couldn't read the condition list from the server");
          });
        }
      }
    };

    return directive;
  };

canto.directive('conditionPicker', ['CursConditionList', 'toaster', conditionPicker]);

var alleleNameComplete =
  function(CursAlleleList, toaster) {
    var directive = {
      scope: {
        allelePrimaryIdentifier: '=',
        alleleName: '=',
        alleleDescription: '=',
        alleleType: '=',
        geneIdentifier: '@',
        placeholder: '@'
      },
      restrict: 'E',
      replace: true,
      template: '<span><input ng-model="alleleName" placeholder="{{placeholder}}" type="text" class="curs-allele-name aform-control" value=""/></span>',
      controller: function ($scope) {
        $scope.clicked = function () {
          $scope.merge = $scope.alleleDescription + ' ' + $scope.allelePrimaryIdentifier;
        };
      },
      link: function(scope, elem) {
        var processResponse = function(lookupResponse) {
          return $.map(
            lookupResponse,
            function(el) {
              return {
                value: el.name,
                allele_primary_identifier: el.uniquename,
                display_name: el.display_name,
                description: el.description,
                type: el.type,
              };
            });
        };
        elem.find('input').autocomplete({
          source: function(request, response) {
            CursAlleleList.alleleList(scope.geneIdentifier, request.term)
              .then(function(lookupResponse) {
                response(processResponse(lookupResponse));
              })
            .catch(function() {
              toaster.pop("failed to lookup allele of: " + scope.geneName);
            });
          },
          select: function(event, ui) {
            scope.$apply(function() {
            if (typeof(ui.item.allele_primary_identifier) === 'undefined') {
              scope.allelePrimaryIdentifier = '';
            } else {
              scope.allelePrimaryIdentifier = ui.item.allele_primary_identifier;
            }
            scope.alleleType = ui.item.type;
            if (typeof(ui.item.label) === 'undefined') {
              scope.alleleName = '';
            } else {
              scope.alleleName = ui.item.label;
            }
            if (typeof(ui.item.description) === 'undefined') {
              scope.alleleDescription = '';
            } else {
              scope.alleleDescription = ui.item.description;
            }
            });
          }
        }).data("autocomplete" )._renderItem = function(ul, item) {
          return $( "<li></li>" )
            .data( "item.autocomplete", item )
            .append( "<a>" + item.display_name + "</a>" )
            .appendTo( ul );
        };
      }
    };

    return directive;
  };

canto.directive('alleleNameComplete', ['CursAlleleList', 'toaster', alleleNameComplete]);


var alleleEditDialogCtrl =
  function($scope, $uibModalInstance, toaster, CantoConfig, args) {
    $scope.alleleData = {};
    copyObject(args.allele, $scope.alleleData);
    $scope.alleleData.primary_identifier = $scope.alleleData.primary_identifier || '';
    $scope.alleleData.name = $scope.alleleData.name || '';
    $scope.alleleData.description = $scope.alleleData.description || '';
    $scope.alleleData.type = $scope.alleleData.type || '';
    $scope.alleleData.expression = $scope.alleleData.expression || '';
    $scope.alleleData.evidence = $scope.alleleData.evidence || '';

    $scope.env = {
    };

    $scope.name_autopopulated = false;

    $scope.env.allele_type_names_promise = CantoConfig.get('allele_type_names');
    $scope.env.allele_types_promise = CantoConfig.get('allele_types');

    $scope.env.allele_type_names_promise.then(function(response) {
      $scope.env.allele_type_names = response.data;
    });

    $scope.env.allele_types_promise.then(function(response) {
      $scope.env.allele_types = response.data;
    });

    $scope.maybe_autopopulate = function() {
      if (typeof this.current_type_config === 'undefined') {
        return '';
      }
      var autopopulate_name = this.current_type_config.autopopulate_name;
      if (typeof(autopopulate_name) === 'undefined') {
        return '';
      }

      $scope.alleleData.name =
        autopopulate_name.replace(/@@gene_display_name@@/, $scope.alleleData.gene_display_name);
      return this.alleleData.name;
    };

    $scope.$watch('alleleData.type',
                  function(newType, oldType) {
                    $scope.env.allele_types_promise.then(function(response) {
                      $scope.current_type_config = response.data[newType];

                      if (newType === oldType) {
                        return;
                      }

                      if ($scope.alleleData.primary_identifier) {
                        return;
                      }

                      if ($scope.name_autopopulated) {
                        if ($scope.name_autopopulated == $scope.alleleData.name) {
                          $scope.alleleData.name = '';
                        }
                        $scope.name_autopopulated = '';
                      }

                      $scope.name_autopopulated = $scope.maybe_autopopulate();
                      $scope.alleleData.description = '';
                      $scope.alleleData.expression = '';
                    });
                  });

    $scope.isValidType = function() {
      return !!$scope.alleleData.type;
    };

    $scope.isValidName = function() {
      return !$scope.current_type_config || !$scope.current_type_config.allele_name_required || $scope.alleleData.name;
    };

    $scope.isValidDescription = function() {
      return !$scope.current_type_config || !$scope.current_type_config.description_required || $scope.alleleData.description;
    };

    $scope.isValidExpression = function() {
      return $scope.current_type_config &&
        (!$scope.current_type_config.expression_required ||
         $scope.alleleData.expression);
    };

    $scope.isExistingAllele = function() {
      return !!$scope.alleleData.primary_identifier;
    };

    $scope.isValid = function() {
      return $scope.isValidExpression() &&
        ($scope.isExistingAllele() ||
         $scope.isValidType() && $scope.isValidName() &&
         $scope.isValidDescription());
    };

    $scope.ok = function () {
      if ($scope.isValid()) {
        copyObject($scope.alleleData, args.allele);
        $uibModalInstance.close(args.allele);
      } else {
        toaster.pop('error', "No changes have been made");
      }
    };

    $scope.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };
  };

canto.controller('AlleleEditDialogCtrl',
                 ['$scope', '$uibModalInstance', 'toaster', 'CantoConfig', 'args',
                 alleleEditDialogCtrl]);

var termSuggestDialogCtrl =
  function($scope, $uibModalInstance) {
    $scope.suggestion = {
      name: '',
      definition: '',
    };

    $scope.isValidName = function() {
      return $scope.suggestion.name;
    };

    $scope.isValidDefinition = function() {
      return $scope.suggestion.definition;
    };

    $scope.isValid = function() {
      return $scope.isValidName() && $scope.isValidDefinition();
    };

    // return the data from the dialog as an Object
    $scope.dialogToData = function($scope) {
      return {
        name: $scope.suggestion.name,
        definition: $scope.suggestion.definition,
      };
    };

    $scope.ok = function () {
      $uibModalInstance.close($scope.dialogToData($scope));
    };

    $scope.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };
  };

canto.controller('TermSuggestDialogCtrl',
                 ['$scope', '$uibModalInstance',
                 termSuggestDialogCtrl]);


function storeGenotype(toaster, $http, genotype_id, genotype_name, genotype_background, alleles) {
  var url = curs_root_uri + '/feature/genotype';

  if (genotype_id) {
    url += '/edit/' + genotype_id;
  } else {
    url += '/store';
  }

  var data = {
    genotype_name: genotype_name,
    genotype_background: genotype_background,
    alleles: alleles,
  };

  loadingStart();

  var result = $http.post(url, data);

  result.finally(loadingEnd);

  return result;
}

function makeAlleleEditInstance($uibModal, allele, endogenousWildtypeAllowed)
{
  return $uibModal.open({
    templateUrl: app_static_path + 'ng_templates/allele_edit.html',
    controller: 'AlleleEditDialogCtrl',
    title: 'Add an allele for this phenotype',
    animate: false,
    windowClass: "modal",
    resolve: {
      args: function() {
        return {
          allele: allele,
        };
      }
    },
    backdrop: 'static',
  });
}


var genePageCtrl =
  function($scope, $uibModal, toaster, $http, CantoGlobals) {
    $scope.singleAlleleQuick = function(gene_display_name, gene_systematic_id, gene_id) {
      var editInstance = makeAlleleEditInstance($uibModal,
                                                {
                                                  gene_display_name: gene_display_name,
                                                  gene_systematic_id: gene_systematic_id,
                                                  gene_id: gene_id,
                                                });

      editInstance.result.then(function (alleleData) {
        var storePromise =
          storeGenotype(toaster, $http, undefined, undefined, undefined, [alleleData], true);

        storePromise.then(function(result) {
          window.location.href =
            CantoGlobals.curs_root_uri + '/genotype_manage#/select/' + result.data.genotype_id;
        });
      });
    };
  };

canto.controller('GenePageCtrl', ['$scope', '$uibModal', 'toaster', '$http', 'CantoGlobals',
                                  genePageCtrl]);


var singleGeneAddDialogCtrl =
  function($scope, $uibModalInstance, $q, toaster, CantoService, Curs) {
    $scope.gene = {
      searchIdentifier: '',
      message: null,
      valid: false,
    };

    $scope.isValid = function() {
      return $scope.gene.primaryIdentifier != null;
    };

    var cancelPromise = null;

    $scope.$watch('gene.searchIdentifier',
                  function() {
                    $scope.gene.message = null;
                    $scope.gene.primaryIdentifier = null;

                    if (cancelPromise != null) {
                      cancelPromise.resolve();
                      cancelPromise = null;
                    }

                    if ($scope.gene.searchIdentifier.length >= 2) {
                      cancelPromise = $q.defer();

                      var promise = CantoService.lookup('gene', [$scope.gene.searchIdentifier],
                                                        undefined, cancelPromise);

                      promise.success(function(data) {
                        if (data.missing.length > 0) {
                          $scope.gene.message = 'Not found';
                          $scope.gene.primaryIdentifier = null;
                        } else {
                          if (data.found.length > 1) {
                            $scope.gene.message =
                              'There is more than one gene matching gene, try a ' +
                              'systematic ID instead: ' +
                              $.map(data.found,
                                    function(gene) {
                                      return gene.primary_identifier || gene.primary_name;
                                    }).join(', ');
                            $scope.gene.primaryIdentifier = null;
                          } else {
                            $scope.gene.message = 'Found: ';

                            if (data.found[0].primary_name) {
                              $scope.gene.message +=
                                data.found[0].primary_name + '(' + data.found[0].primary_identifier + ')';
                            } else {
                              $scope.gene.message += data.found[0].primary_identifier;
                            }
                            $scope.gene.primaryIdentifier = data.found[0].primary_identifier;
                          }
                        }
                      });
                    }
                  });

    $scope.ok = function () {
      var promise = Curs.add('gene', [$scope.gene.primaryIdentifier]);

      promise.success(function(data) {
        if (data.status === 'error') {
          toaster.pop('error', data.message);
        } else {
          if (data.gene_id == null) {
            // null if the gene was already in the list
            toaster.pop('info', $scope.gene.primaryIdentifier +
                        ' is already added to this session');
          }
          $uibModalInstance.close({
            new_gene_id: data.gene_id,
          });
        }
      })
      .error(function() {
        toaster.pop('error', 'Failed to add gene, could not contact the Canto server');
      });
    };

    $scope.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };
  };

canto.controller('SingleGeneAddDialogCtrl',
                 ['$scope', '$uibModalInstance', '$q', 'toaster', 'CantoService', 'Curs',
                 singleGeneAddDialogCtrl]);

var genotypeEdit =
  function($http, $uibModal, CantoConfig, CantoGlobals, Curs, toaster) {
    return {
      scope: {
        editOrDuplicate: '@',
        genotypeId: '@',
        storedCallback: '&',
        cancelCallback: '&',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/genotype_edit.html',
      controller: function($scope) {
        $scope.app_static_path = CantoGlobals.app_static_path;

        $scope.getGenesFromServer = function() {
          Curs.list('gene').success(function(results) {
            $scope.genes = results;

            $.map($scope.genes,
                  function(gene) {
                    gene.display_name = gene.primary_name || gene.primary_identifier;
                  });
          }).error(function() {
            toaster.pop('error', 'failed to get gene list from server');
          });
        };

        $scope.reset = function() {
          $scope.alleles = [
          ];

          $scope.genes = [
          ];

          $scope.getGenesFromServer();

          $scope.data = {
            annotationCount: 0,
            genotypeName: null,
            genotypeBackground: null,
          };

          $scope.wildTypeCheckPasses = true;
        };

        $scope.reset();

        if ($scope.genotypeId) {
          if ($scope.editOrDuplicate == 'edit') {
            $scope.data.genotype_id = $scope.genotypeId;
          }
          Curs.details('genotype', ['by_id', $scope.genotypeId])
            .success(function(genotypeDetails) {
              $scope.alleles = genotypeDetails.alleles;
              $scope.data.genotypeName = genotypeDetails.name;
              $scope.data.genotypeBackground = genotypeDetails.background;
              $scope.data.annotationCount = genotypeDetails.annotation_count;
            });
        }

        $scope.env = {
          curs_config_promise: CantoConfig.get('curs_config')
        };

        $scope.$watch('alleles',
                      function() {
                        $scope.env.curs_config_promise.then(function(response) {
                          $scope.data.genotype_long_name =
                            response.data.genotype_config.default_strain_name +
                            " " +
                            $.map($scope.alleles, function(val) {
                              var newName = val.name || 'no_name';
                              if (val.description === '') {
                                newName += "(" + val.type + ")";
                              } else {
                                newName += "(" + val.description + ")";
                              }
                              if (val.expression !== '') {
                                newName += "[" + val.expression + "]";
                              }
                              return newName;
                            }).join(" ");
                        });

                        $scope.wildTypeCheckPasses = $scope.checkWildtypeExpression();
                      },
                      true);

        // check for endogenous wild types allele where there isn't a
        // allele of the same gene
        // See: https://github.com/pombase/canto/issues/797
        $scope.checkWildtypeExpression = function() {
          var wildTypeStates = {};

          $.map($scope.alleles,
                function(allele) {
                  var currentState = wildTypeStates[allele.gene_id];

                  if (currentState == 'seen_non_wt_product_level_wt') {
                    return;
                  }

                  if (allele.type != 'wild type' ||
                      allele.expression != 'Wild type product level')  {
                    wildTypeStates[allele.gene_id] = 'seen_non_wt_product_level_wt';
                    return;
                  } else {
                    wildTypeStates[allele.gene_id] = 'seen_wt_product_level';
                  }
                });

          var wildTypeCheckPasses = true;

          $.each(wildTypeStates,
                 function(idx, state) {
                   if (state == 'seen_wt_product_level') {
                     wildTypeCheckPasses = false;
                   }
                 });

          return wildTypeCheckPasses;
        };

        $scope.store = function() {
          var result =
              storeGenotype(toaster, $http, $scope.data.genotype_id,
                            $scope.data.genotypeName, $scope.data.genotypeBackground,
                            $scope.alleles);

          result.success(function(data) {
            if (data.status === "success") {
              if ($scope.data.genotype_id) {
                toaster.pop('info', "Successfully stored changes");
              } else {
                toaster.pop('info', "Created new genotype: " + data.genotype_display_name);
              }
              $scope.storedCallback({genotypeId: data.genotype_id});
              $scope.reset();
            } else {
              if (data.status === "existing") {
                toaster.pop('info', "Using existing genotype: " + data.genotype_display_name);
                $scope.storedCallback({genotypeId: data.genotype_id});
                $scope.reset();
              } else {
                toaster.pop('error', data.message);
              }
            }
          }).
          error(function(data, status){
            toaster.pop('error', "Accessing server failed: " + (data || status) );
          });
        };

        $scope.removeAllele = function (allele) {
          $scope.alleles.splice($scope.alleles.indexOf(allele), 1);
        };

        $scope.allelesEqual = function(allele1, allele2) {
          return angular.equals(allele1, allele2);
        };

        $scope.findExistingAlleleIdx = function(allele) {
          var index = $scope.alleles.indexOf(allele);

          if (index >= 0) {
            return index;
          }

          $.map($scope.alleles,
                function(existingAllele, mapIndex) {
                  if ($scope.allelesEqual(existingAllele, allele)) {
                    index = mapIndex;
                  }
                });

          return index;
        };

        $scope.openAlleleEditDialog =
          function(allele) {
            if (allele.gene) {
              allele.gene_display_name = allele.gene.display_name;
              allele.gene_systematic_id = allele.gene.primary_identifier;
              allele.gene_id = allele.gene.gene_id;
              delete allele.gene;
            }

            var editInstance =
                makeAlleleEditInstance($uibModal, allele);

            editInstance.result.then(function (editedAllele) {
              if ($scope.findExistingAlleleIdx(editedAllele) < 0) {
                $scope.alleles.push(editedAllele);
              } else {
                toaster.pop('info', 'Not adding duplicate allele');
              }
            });
          };

        $scope.openSingleGeneAddDialog = function() {
          var modal = openSingleGeneAddDialog($uibModal);
          modal.result.then(function () {
            $scope.getGenesFromServer();
          });
        };

        $scope.cancel = function() {
          $scope.cancelCallback();
        };

        $scope.isValid = function() {
          return $scope.alleles.length > 0 && $scope.wildTypeCheckPasses;
        };
      }
    }
  };

canto.directive('genotypeEdit',
                ['$http', '$uibModal', 'CantoConfig', 'CantoGlobals', 'Curs', 'toaster',
                 genotypeEdit]);


var genotypeViewCtrl =
  function($scope, CantoGlobals) {
    $scope.init = function(annotationCount) {
      $scope.annotationCount = annotationCount;
    };

    $scope.editGenotype = function(genotypeId) {
      window.location.href =
        CantoGlobals.curs_root_uri + '/genotype_manage#/edit/' + genotypeId;
    };

    $scope.backToGenotypes = function() {
      window.location.href = CantoGlobals.curs_root_uri +
        '/genotype_manage' + (CantoGlobals.read_only_curs ? '/ro' : '');
    };
  };

canto.controller('GenotypeViewCtrl',
                 ['$scope', 'CantoGlobals', genotypeViewCtrl]);


var GenotypeManageCtrl =
  function($scope, $location, Curs, CursGenotypeList, CantoGlobals, toaster) {
    $scope.app_static_path = CantoGlobals.app_static_path;
    $scope.read_only_curs = CantoGlobals.read_only_curs;
    $scope.curs_root_uri = CantoGlobals.curs_root_uri;

    $scope.data = {
      genotypes: [],
      waitingForServer: true,
      selectedGenotypeId: null,
      editingGenotype: false,
      editGenotypeId: null,
    };

    function hashChangedHandler() {
      var path = $location.path();

      if (path) {
        var res = /^\/(select|edit|duplicate)\/(\d+)$/.exec(path);
        if (res) {
          if (res[1] == 'select') {
            $scope.data.selectedGenotypeId = res[2];
          } else {
            if (res[1] == 'edit' || res[1] == 'duplicate') {
              $scope.data.editOrDuplicate = res[1];
              $scope.data.editGenotypeId = res[2];
              $scope.data.editingGenotype = true;
            }
          }
        }
      }
    }

    window.addEventListener('load', hashChangedHandler);
    window.addEventListener('hashchange', hashChangedHandler);

    $scope.addGenotype = function() {
      $scope.data.editingGenotype = true;
      $scope.data.selectedGenotypeId = null;
    };

    $scope.cancelEdit = function() {
      $scope.data.editingGenotype = false;
      $location.path('/select/' + $scope.data.editGenotypeId);
      $scope.data.editGenotypeId = null;
    };

    $scope.storedCallback = function(genotypeId) {
      if ($scope.data.editGenotypeId) {
        $location.path('/select/' + $scope.data.editGenotypeId);
      }
      $scope.data.editingGenotype = false;
      $scope.data.editGenotypeId = null;
      $scope.readGenotypes();
    };

    $scope.readGenotypes = function() {
      CursGenotypeList.cursGenotypeList({ include_allele: 1 }).then(function(results) {
        $scope.data.genotypes = results;
        $scope.data.waitingForServer = false;
      }).catch(function() {
        toaster.pop('error', "couldn't read the genotype list from the server");
        $scope.data.waitingForServer = false;
      });
    };

    $scope.backToSummary = function() {
      window.location.href = CantoGlobals.curs_root_uri +
        (CantoGlobals.read_only_curs ? '/ro' : '');
    };

    $scope.readGenotypes();
  };

canto.controller('GenotypeManageCtrl',
                 ['$scope', '$location', 'Curs', 'CursGenotypeList', 'CantoGlobals', 'toaster',
                 GenotypeManageCtrl]);

var geneSelectorCtrl =
  function(CursGeneList, $uibModal, toaster) {
    return {
      scope: {
        selectedGenes: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/gene_selector.html',
      controller: function($scope) {
        $scope.data = {
          genes: [],
        };

        function getGenesFromServer() {
          CursGeneList.geneList().then(function(results) {
            $scope.data.genes = results;
          }).catch(function() {
            toaster.pop('note', "couldn't read the gene list from the server");
          });
        }

        getGenesFromServer();

        $scope.addAnotherGene = function() {
          var modal = openSingleGeneAddDialog($uibModal);
          modal.result.then(function () {
            getGenesFromServer();
          });
        };

      },
      link: function(scope) {
        scope.selectedGenesFilter = function() {
          scope.selectedGenes = $.grep(scope.data.genes, function(gene) {
            return gene.selected;
          });
        };
      },
    };
  };

canto.directive('geneSelector',
                ['CursGeneList', '$uibModal', 'toaster',
                  geneSelectorCtrl]);

var genotypeSearchCtrl =
  function(CursGenotypeList, CantoGlobals) {
    return {
      scope: {
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/genotype_search.html',
      controller: function($scope) {
        $scope.data = {
          filteredCursGenotypes: [],
          filteredExternalGenotypes: [],
          searchGenes: [],
          waitingForServerCurs: false,
          waitingForServerExternal: false,
        };
        $scope.app_static_path = CantoGlobals.app_static_path;

        $scope.addGenotype = function() {
          window.location.href = CantoGlobals.curs_root_uri + '/feature/genotype/add';
        };

        $scope.waitingForServer = function() {
          return $scope.data.waitingForServerCurs || $scope.data.waitingForServerExternal;
        };

        $scope.filteredGenotypeCount = function() {
          return $scope.data.filteredCursGenotypes.length +
            $scope.data.filteredExternalGenotypes.length;
        };
      },
      link: function(scope) {
        scope.$watch('data.searchGenes',
                      function() {
                        if (scope.data.searchGenes.length == 0) {
                          scope.data.filteredCursGenotypes.length = 0;
                          scope.data.filteredExternalGenotypes.length = 0;
                        } else {
                          scope.data.waitingForServerCurs = true;
                          scope.data.waitingForServerExternal = true;
                          var geneIdentifiers = $.map(scope.data.searchGenes,
                                                      function(gene_data) {
                                                        return gene_data.primary_identifier;

                                                      });
                          CursGenotypeList.filteredGenotypeList('curs_only', {
                            gene_identifiers: geneIdentifiers
                          }).then(function(results) {
                            scope.data.filteredCursGenotypes = results;
                            scope.data.waitingForServerCurs = false;
                            delete scope.data.serverError;
                          }).catch(function() {
                            scope.data.waitingForServerCurs = false;
                            scope.data.serverError = "couldn't read the genotype list from the server";
                          });
                          CursGenotypeList.filteredGenotypeList('external_only', {
                            gene_identifiers: geneIdentifiers
                          }).then(function(results) {
                            scope.data.filteredExternalGenotypes = results;
                            scope.data.waitingForServerExternal = false;
                            delete scope.data.serverError;
                          }).catch(function() {
                            scope.data.waitingForServerExternal = false;
                            scope.data.serverError = "couldn't read the genotype list from the server";
                          });
                        }
                      });
      },
    };
  };

canto.directive('genotypeSearch',
                 ['CursGenotypeList', 'CantoGlobals',
                  genotypeSearchCtrl]);

var genotypeListRowLinksCtrl =
  function(toaster, CantoGlobals, CursGenotypeList) {
    return {
      restrict: 'E',
      scope: {
        genotypes: '=',
        genotypeId: '=',
        annotationCount: '@',
      },
      replace: true,
      templateUrl: CantoGlobals.app_static_path + 'ng_templates/genotype_list_row_links.html',
      controller: function($scope) {
        $scope.curs_root_uri = CantoGlobals.curs_root_uri;
        $scope.read_only_curs = CantoGlobals.read_only_curs;

        $scope.editGenotype = function(genotypeId) {
          window.location.href =
            CantoGlobals.curs_root_uri + '/genotype_manage#/edit/' + genotypeId;
        };

        $scope.deleteGenotype = function(genotypeId) {
          loadingStart();

          var q = CursGenotypeList.deleteGenotype($scope.genotypes, genotypeId);

          q.then(function() {
            toaster.pop('success', 'Genotype deleted');
          });

          q.catch(function(message) {
            if (message.match('genotype .* has annotations')) {
              toaster.pop('warning', "couldn't delete the genotype: delete the annotations that use it first");
            } else {
              toaster.pop('error', "couldn't delete the genotype: " + message);
            }
          });

          q.finally(function() {
            loadingEnd();
          });
        };
      },
      link: function($scope) {
        if ($scope.navigateOnClick) {
          $scope.detailsUrl =
            CantoGlobals.curs_root_uri + '/genotype_manage' +
            (CantoGlobals.read_only_curs ? '/ro' : '') + '#/select/' +
            $scope.genotype.id_or_identifier;
        } else {
          $scope.detailsUrl = '#';
          $scope.viewAnnotationUri =
            CantoGlobals.curs_root_uri + '/feature/genotype/view/' + $scope.genotypeId;
          if (CantoGlobals.read_only_curs) {
            $scope.viewAnnotationUri += '/ro';
          }
        }
      },
    };
  };

canto.directive('genotypeListRowLinks',
                ['toaster', 'CantoGlobals', 'CursGenotypeList',
                 genotypeListRowLinksCtrl]);

var genotypeListRowCtrl =
  function($compile, $timeout, CantoGlobals) {
    return {
      restrict: 'A',
      scope: {
        genotypes: '=',
        genotype: '=',
        selectedGenotypeId: '@',
        setSelectedGenotypeId: '&',
        navigateOnClick: '@',
        columnsToHide: '=',
      },
      replace: true,
      templateUrl: CantoGlobals.app_static_path + 'ng_templates/genotype_list_row.html',
      controller: function($scope, $element) {
        $scope.curs_root_uri = CantoGlobals.curs_root_uri;
        $scope.read_only_curs = CantoGlobals.read_only_curs;
        $scope.app_static_path = CantoGlobals.app_static_path;
        $scope.closeIconPath = CantoGlobals.app_static_path + '/images/close_icon.png';

        $scope.firstAllele = $scope.genotype.alleles[0];
        $scope.otherAlleles = $scope.genotype.alleles.slice(1);

        $scope.isSelected = function() {
          return $scope.selectedGenotypeId &&
            $scope.selectedGenotypeId == $scope.genotype.genotype_id;
        };

        $scope.clearSelection = function() {
          $scope.setSelectedGenotypeId({ genotypeId: null });
          var links = $('#curs-genotype-list-row-actions');
          links.remove();
        };

        $scope.mouseOver = function() {
          if ($scope.navigateOnClick != 'true') {
            $scope.setSelectedGenotypeId({ genotypeId: $scope.genotype.genotype_id });
          }
        };
      },
      link: function($scope) {
        if ($scope.navigateOnClick) {
          $scope.detailsUrl =
            CantoGlobals.curs_root_uri + '/feature/genotype/view/' +
            $scope.genotype.id_or_identifier +
            (CantoGlobals.read_only_curs ? '/ro' : '');
        } else {
          $scope.detailsUrl = '#';
        }
      },
    };
  };

canto.directive('genotypeListRow',
                ['$compile', '$timeout', 'CantoGlobals', 'CursGenotypeList',
                 genotypeListRowCtrl]);


var genotypeListViewCtrl =
  function() {
    return {
      scope: {
        genotypeList: '=',
        selectedGenotypeId: '=',
        navigateOnClick: '@'
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/genotype_list_view.html',
      controller: function($scope) {
        $scope.columnsToHide = { background: true,
                                 name: true, };

        $scope.setSelectedGenotypeId = function(genotypeId) {
          $scope.selectedGenotypeId = genotypeId;
        }

        $scope.$watch('genotypeList',
                      function() {
                        $.map($scope.genotypeList,
                              function(genotype) {
                                if (genotype.background) {
                                  $scope.columnsToHide.background = false;
                                }
                                if (genotype.name) {
                                  $scope.columnsToHide.name = false;
                                }
                              });
                      }, true);
      },
   };
  };

canto.directive('genotypeListView',
                ['$compile', genotypeListViewCtrl]);


var singleGeneGenotypeList =
  function(CursGenotypeList, CantoGlobals) {
    return {
      scope: {
        genePrimaryIdentifier: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/single_gene_genotype_list.html',
      controller: function($scope) {
        $scope.app_static_path = CantoGlobals.app_static_path;
        $scope.curs_root_uri = CantoGlobals.curs_root_uri;
        $scope.data = {
          filteredGenotypes: [],
          waitingForServer: true,
          showAll: false,
        };

        $scope.shouldShowAll = function() {
          return $scope.data.showAll;
        };

        $scope.showAll = function() {
          $scope.data.showAll = true;
        };

        $scope.hideAll = function() {
          $scope.data.showAll = false;
        };

        CursGenotypeList.filteredGenotypeList('curs_only', {
          gene_identifiers: [$scope.genePrimaryIdentifier],
        }).then(function(results) {
          $scope.data.filteredGenotypes = results;
          $scope.data.waitingForServer = false;
          if (results.length > 0 && results.length <= 5) {
            $scope.data.showAll = true;
          }
          delete $scope.data.serverError;
        }).catch(function() {
          $scope.data.waitingForServer = false;
          $scope.data.serverError = "couldn't read the genotype list from the server";
        });

      },
    };
  };

canto.directive('singleGeneGenotypeList',
                ['CursGenotypeList', 'CantoGlobals', singleGeneGenotypeList]);


var genotypeAlleles =
  function(CantoGlobals) {
    return {
      scope: {
        genotype: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/genotype_alleles.html',
      controller: function($scope) {
        $scope.read_only_curs = CantoGlobals.read_only_curs;
        $scope.curs_root_uri = CantoGlobals.curs_root_uri;
      }
    };
  };


canto.directive('genotypeAlleles',
                ['CantoGlobals', genotypeAlleles]);

var genotypeDetails =
  function(CantoGlobals) {
    return {
      scope: {
        genotype: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/genotype_details.html',
      controller: function($scope) {
        $scope.app_static_path = CantoGlobals.app_static_path;
        $scope.read_only_curs = CantoGlobals.read_only_curs;
        $scope.curs_root_uri = CantoGlobals.curs_root_uri;
      }
    };
  };


canto.directive('genotypeDetails',
                ['CantoGlobals', genotypeDetails]);


canto.service('CantoConfig', function($http) {
  this.promises = {};

  this.get = function(key) {
    if (!this.promises[key]) {
      this.promises[key] =
        $http({method: 'GET',
               url: application_root + 'ws/canto_config/' + key});
    }
    return this.promises[key];
  };
});

canto.service('AnnotationTypeConfig', function(CantoConfig, $q) {
  this.getAll = function() {
    if (typeof(this.listPromise) === 'undefined') {
      this.listPromise = CantoConfig.get('annotation_type_list');
    }

    return this.listPromise;
  };
  this.getByKeyValue = function(key, value) {
    var q = $q.defer();

    this.getAll().success(function(annotationTypeList) {
      var filteredAnnotationTypes =
        $.grep(annotationTypeList,
               function(annotationType) {
                 return annotationType[key] === value;
               });
      if (filteredAnnotationTypes.length > 0){
        q.resolve(filteredAnnotationTypes[0]);
      } else {
        q.resolve(undefined);
      }
    }).error(function(data, status) {
      if (status) {
        q.reject();
      } // otherwise the request was cancelled
    });

    return q.promise;

  };
  this.getByName = function(typeName) {
    return this.getByKeyValue('name', typeName);
  };
  this.getByNamespace = function(namespace) {
    return this.getByKeyValue('namespace', namespace);
  };
});


function UploadGenesCtrl($scope) {
  $scope.data = {
    geneIdentifiers: '',
    noAnnotation: false,
    noAnnotationReason: '',
    otherText: '',
    geneList: '',
  };
  $scope.isValid = function() {
    return $scope.data.geneIdentifiers.length > 0 ||
      ($scope.data.noAnnotation &&
       $scope.data.noAnnotationReason.length > 0 &&
       ($scope.data.noAnnotationReason !== "Other" ||
        $scope.data.otherText.length > 0));
  };
}

canto.controller('UploadGenesCtrl', UploadGenesCtrl);


function SubmitToCuratorsCtrl($scope) {
  $scope.data = {
    reason: null,
    otherReason: '',
    hasAnnotation: false
  };
  $scope.noAnnotationReasons = [];

  $scope.init = function(reasons) {
    $scope.noAnnotationReasons = reasons;
  };

  $scope.validReason = function() {
    return $scope.data.reason != null && $scope.data.reason.length > 0 &&
      ($scope.data.reason !== 'Other' || $scope.data.otherReason.length > 0);
  };
}

canto.controller('SubmitToCuratorsCtrl', SubmitToCuratorsCtrl);

var termConfirmDialogCtrl =
  function($scope, $uibModalInstance, CantoService, CantoGlobals, args) {
    $scope.app_static_path = CantoGlobals.app_static_path;

    $scope.data = {
      initialTermId: args.termId,
      featureType: args.featureType,
      state: 'definition',
      termDetails: null,
    };

    $scope.setTerm = function(termId) {
      var promise = CantoService.lookup('ontology', [termId],
                                        {
                                          def: 1,
                                          children: 1,
                                        });

      promise.success(function(termDetails) {
        $scope.data.termDetails = termDetails;

        if (args.initialState) {
          $scope.data.state = args.initialState;
          delete args.initialState;
        } else {
          $scope.data.state = 'definition';
        }
      });
    };

    $scope.setTerm($scope.data.initialTermId);

    $scope.gotoChild = function(childId) {
      $scope.setTerm(childId);
    };

    $scope.next = function() {
      $scope.data.state = 'children';
    };

    $scope.back = function() {
      $scope.data.state = 'definition';
    };

    $scope.finish = function() {
      $uibModalInstance.close({ newTermId: $scope.data.termDetails.id,
                             newTermName: $scope.data.termDetails.name });
    };

    $scope.cancel = function() {
      $uibModalInstance.dismiss('cancel');
    };
  };


canto.controller('TermConfirmDialogCtrl',
                 ['$scope', '$uibModalInstance', 'CantoService', 'CantoGlobals', 'args',
                  termConfirmDialogCtrl]);



var termDefinitionDisplayCtrl =
  function() {
    return {
      scope: {
        termDetails: '=',
        matchingSynonym: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/term_definition.html',
    };
  };

canto.directive('termDefinitionDisplay', [termDefinitionDisplayCtrl]);


var termChildrenDisplayCtrl =
  function(CantoGlobals) {
    return {
      scope: {
        termDetails: '=',
        gotoChildCallback: '&',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/term_children.html',
      controller: function($scope) {
        $scope.CantoGlobals = CantoGlobals;
        $scope.gotoChild = function(childId) {
          $scope.gotoChildCallback({ childId: childId });
        };
      },
    };
  };

canto.directive('termChildrenDisplay',
                ['CantoGlobals',
                 termChildrenDisplayCtrl]);


var annotationEditDialogCtrl =
  function($scope, $uibModal, $q, $uibModalInstance, AnnotationProxy,
           AnnotationTypeConfig, CantoConfig,
           CursSessionDetails, CantoService, CantoGlobals, toaster, args) {
    $scope.currentUserIsAdmin = CantoGlobals.current_user_is_admin;
    $scope.annotation = { };
    $scope.annotationTypeName = args.annotationTypeName;
    $scope.currentFeatureDisplayName = args.currentFeatureDisplayName;
    $scope.newlyAdded = args.newlyAdded;
    $scope.featureEditable = args.featureEditable;
    $scope.matchingConfigurations = [];
    $scope.status = {
      validEvidence: false,
      showConditions: false,
    };

    copyObject(args.annotation, $scope.annotation);

    $scope.isValidFeature = function() {
      return $scope.annotation.feature_id;
    };

    $scope.isValidInteractingGene = function() {
      return $scope.annotation.interacting_gene_id;
    };

    $scope.isValidTerm = function() {
      return $scope.annotation.term_ontid;
    };

    $scope.isValidEvidence = function() {
      return $scope.status.validEvidence;
    };

    $scope.annotationChanged = function() {
      var changesToStore = {};

      if ($scope.annotation.term_suggestion_name == '') {
        $scope.annotation.term_suggestion_name = null;
      }
      if ($scope.annotation.term_suggestion_definition == '') {
        $scope.annotation.term_suggestion_definition = null;
      }
      if ($scope.annotation.submitter_comment == '') {
        $scope.annotation.submitter_comment = null;
      }

      copyIfChanged(args.annotation, $scope.annotation, changesToStore);
      delete changesToStore.feature_type;

      return countKeys(changesToStore) > 0;
    };

    $scope.okButtonTitleMessage = function() {
      if ($scope.isValid()) {
        if ($scope.annotationChanged()) {
          return 'Finish editing';
        } else {
          return 'Make some changes or click "Cancel"';
        }
      } else {
        return 'Annotation is incomplete - please edit the fields marked in red';
      }
    };

    $scope.extConfigPromise = CantoConfig.get('extension_configuration');

    $scope.$watch('annotation.term_ontid',
                  function() {
                    $scope.matchingConfigurations = [];

                    if ($scope.annotation.term_ontid) {
                      var ontLookupPromise =
                          CantoService.lookup('ontology', [$scope.annotation.term_ontid],
                                              {
                                                subset_ids: 1,
                                              });

                      $q.all([$scope.extConfigPromise, ontLookupPromise])
                        .then(function(results) {
                          var extensionConfiguration = results[0].data;
                          var termDetails = results[1].data;

                          var subset_ids = termDetails.subset_ids;

                          if (extensionConfiguration.length > 0 &&
                              subset_ids && subset_ids.length > 0) {
                            $scope.matchingConfigurations =
                              extensionConfFilter(extensionConfiguration, subset_ids,
                                                  CantoGlobals.current_user_is_admin ? 'admin' : 'user');
                          } else {
                            $scope.matchingConfigurations = [];
                          }
                        });
                    }
                  });

    $scope.isValid = function() {
      if ($scope.annotationType.category === 'ontology') {
        return $scope.isValidFeature() &&
          $scope.isValidTerm() && $scope.isValidEvidence();
      }
      return $scope.isValidFeature() &&
        $scope.isValidInteractingGene() && $scope.isValidEvidence();
    };

    $scope.termFoundCallback =
      function(termId, termName, searchString) {
        $scope.annotation.term_ontid = termId;
        $scope.annotation.term_name = termName;

        if (!searchString.match(/^".*"$/) && searchString !== termId) {
          var termConfirm = openTermConfirmDialog($uibModal, termId, 'definition',
                                                  $scope.annotationType.feature_type);

          termConfirm.result.then(function(result) {
            $scope.annotation.term_ontid = result.newTermId;
            $scope.annotation.term_name = result.newTermName;
          });
        } // else: user pasted a term ID or user quoted the search - skip confirmation
      };

    $scope.editExtension = function() {
      var editPromise =
        openExtensionBuilderDialog($uibModal, $scope.annotation.extension,
                                   $scope.annotation.term_ontid,
                                   $scope.currentFeatureDisplayName);

      editPromise.then(function(result) {
        angular.copy(result.extension, $scope.annotation.extension);
      });
    };

    $scope.manualEdit = function() {
      var editPromise =
        openExtensionManualEditDialog($uibModal, $scope.annotation.extension, $scope.matchingConfigurations);

      editPromise.then(function(result) {
        $scope.annotation.extension = result.extension;
      });
    };

    $scope.ok = function() {
      var q = AnnotationProxy.storeChanges(args.annotation,
                                           $scope.annotation, args.newlyAdded);
      loadingStart();
      var storePop = toaster.pop({
        type: 'info',
        title: 'Storing annotation ...',
        timeout: 0, // last until the finally()
        showCloseButton: false
      });
      q.then(function(annotation) {
        $uibModalInstance.close(annotation);
      })
      .catch(function(message) {
        toaster.pop('error', message);
      })
      .finally(function() {
        loadingEnd();
        toaster.clear(storePop);
      });
    };

    $scope.cancel = function() {
      $uibModalInstance.dismiss('cancel');
    };

    CursSessionDetails.get()
      .success(function(sessionDetails) {
        $scope.curatorDetails = sessionDetails.curator;
      });

    CantoService.details('user')
      .success(function(user) {
        $scope.userDetails = user.details;
      });

    AnnotationTypeConfig.getByName($scope.annotationTypeName)
      .then(function(annotationType) {
        $scope.annotationType = annotationType;
        $scope.displayAnnotationFeatureType = capitalizeFirstLetter(annotationType.feature_type);
        $scope.annotation.feature_type = annotationType.feature_type;

        if (annotationType.can_have_conditions &&
           !$scope.annotation['conditions']) {
          $scope.annotation.conditions = [];
        }

        if (annotationType.category == 'ontology' &&
            !$scope.annotation['extension']) {
          $scope.annotation.extension = [];
        }
      });
  };


canto.controller('AnnotationEditDialogCtrl',
                 ['$scope', '$uibModal', '$q', '$uibModalInstance', 'AnnotationProxy',
                  'AnnotationTypeConfig', 'CantoConfig',
                  'CursSessionDetails', 'CantoService',
                  'CantoGlobals', 'toaster', 'args',
                  annotationEditDialogCtrl]);

angular.module('cantoApp')
  .directive('ngAltEnter', function($document) {
    return {
      scope: {
        ngAltEnter: "&"
      },
      link: function(scope) {
        var enterWatcher = function(event) {
          if (event.altKey && event.key == "Enter") {
            scope.ngAltEnter();
            scope.$apply();
            event.preventDefault();
          }
        };

        $document.bind("keydown keypress", enterWatcher);

        scope.$on("$destroy",
                  function handleDestroyEvent() {
                    $document.unbind("keydown keypress", enterWatcher);
                  });
      }
    }
  });


function startEditing($uibModal, annotationTypeName, annotation,
                      currentFeatureDisplayName, newlyAdded, featureEditable) {
  var editInstance = $uibModal.open({
    templateUrl: app_static_path + 'ng_templates/annotation_edit.html',
    controller: 'AnnotationEditDialogCtrl',
    title: 'Edit this annotation',
    animate: false,
    size: 'lg',
    resolve: {
      args: function() {
        return {
          annotation: annotation,
          annotationTypeName: annotationTypeName,
          currentFeatureDisplayName: currentFeatureDisplayName,
          newlyAdded: newlyAdded,
          featureEditable: featureEditable,
       };
      }
    },
    backdrop: 'static',
  });

  return editInstance.result;
}


function makeNewAnnotation(template) {
  var copy = {};
  copyObject(template, copy);
  copy.newly_added = true;
  return copy;
}


function addAnnotation($uibModal, annotationTypeName, featureType, featureId,
                       featureDisplayName) {
  var template = {
    annotation_type: annotationTypeName,
    feature_type: featureType,
  };
  if (featureId) {
    template.feature_id = featureId;
  }
  var featureEditable = !featureId;
  var newAnnotation = makeNewAnnotation(template);
  startEditing($uibModal, annotationTypeName, newAnnotation,
               featureDisplayName, true, featureEditable);
}

var annotationQuickAdd =
  function($uibModal, CursSettings, CantoGlobals) {
    return {
      scope: {
        annotationTypeName: '@',
        featureType: '@',
        featureId: '@',
        featureDisplayName: '@',
        linkLabel: '@?'
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/annotation_quick_add.html',
      controller: function($scope) {
        $scope.read_only_curs = CantoGlobals.read_only_curs;

        if (!$scope.linkLabel) {
          $scope.linkLabel = 'Quick add ...';
        }

        $scope.enabled = function() {
          return CursSettings.getAnnotationMode() == 'advanced';
        };

        $scope.add = function() {
          addAnnotation($uibModal, $scope.annotationTypeName, $scope.featureType,
                        $scope.featureId, $scope.featureDisplayName);
        };
      },
    };
  };

canto.directive('annotationQuickAdd', ['$uibModal', 'CursSettings', 'CantoGlobals', annotationQuickAdd]);


function filterAnnotations(annotations, params) {
  return annotations.filter(function(annotation) {
    if (annotation.feature_type == 'genotype' && params.alleleCount && annotation.alleles != undefined) {
      if (params.alleleCount == 'single' && annotation.alleles.length != 1) {
        return false;
      }
      if (params.alleleCount == 'multi' && annotation.alleles.length == 1) {
        return false;
      }
    }

    if (!params.featureStatus ||
        annotation.status === params.featureStatus) {
      if (!params.featureId) {
        return true;
      }
      if (params.featureType) {
        if (params.featureType === 'gene') {
          if (annotation.gene_id == params.featureId) {
            return true;
          }
          if (typeof(annotation.interacting_gene_id) !== 'undefined' &&
              annotation.interacting_gene_id == params.featureId) {
            return true;
          }
          if (annotation.alleles !== undefined &&
              $.grep(annotation.alleles,
                     function(alleleData) {
                       return alleleData.gene_id.toString() === params.featureId;
                     }).length > 0) {
            return true;
          }
        }
        if (params.featureType === 'genotype' &&
            annotation.genotype_id == params.featureId) {
          return true;
        }
      }
    }
    return false;
  });
}


var annotationTableCtrl =
  function(CantoGlobals, AnnotationTypeConfig, CursGenotypeList,
           CursSessionDetails, CantoConfig) {
    return {
      scope: {
        annotationTypeName: '@',
        annotations: '=',
        featureStatusFilter: '@',
        alleleCountFilter: '@',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/annotation_table.html',
      controller: function($scope) {
        $scope.read_only_curs = CantoGlobals.read_only_curs;
        $scope.app_static_path = CantoGlobals.app_static_path;

        $scope.multiOrganismMode = false;

        $scope.data = {};

        $scope.$watch('annotations',
                      function() {
                        if ($scope.annotations) {
                          $scope.updateColumns();
                        }
                      },
                      true);

        var initialHideColumns = {      // columns to hide because they're empty
          with_or_from_identifier: true,  // set to false when a row has a non empty element
          qualifiers: true,
          submitter_comment: true,
          extension: true,
          curator: true,
          genotype_name: true,
          genotype_background: true,
          term_suggestion: true,
          gene_product_form_id: true,
        };

        $scope.data = {
          annotations: null,
          hideColumns: {},
          publicationUniquename: null,
        };

        CursSessionDetails.get()
          .success(function(sessionDetails) {
            $scope.data.publicationUniquename = sessionDetails.publication_uniquename;
          });

        CantoConfig.get('instance_organism').success(function(results) {
          if (!results.taxonid) {
            $scope.multiOrganismMode = true;
          }
        });

        copyObject(initialHideColumns, $scope.data.hideColumns);

        $scope.updateColumns = function() {
          if ($scope.annotations) {
            copyObject(initialHideColumns, $scope.data.hideColumns);
            $.map($scope.annotations,
                  function(annotation) {
                    $.map(initialHideColumns,
                          function(prop, key) {
                            if (key == 'qualifiers' && annotation.is_not) {
                              $scope.data.hideColumns[key] = false;
                            }
                            if (key == 'term_suggestion') {
                              if (annotation.term_suggestion_name || annotation.term_suggestion_definition) {
                                $scope.data.hideColumns[key] = false;
                              }
                            }
                            if (annotation[key] &&
                                (!$.isArray(annotation[key]) || annotation[key].length > 0)) {
                              $scope.data.hideColumns[key] = false;
                            }
                          });
                  });
          }
        };
      },
      link: function($scope) {
        $scope.$watch('annotations.length',
                      function() {
                        AnnotationTypeConfig.getByName($scope.annotationTypeName).then(function(annotationType) {
                          $scope.annotationType = annotationType;
                          $scope.displayAnnotationFeatureType = capitalizeFirstLetter(annotationType.feature_type);
                        });
                      });
      }
    };
  };

canto.directive('annotationTable',
                ['CantoGlobals',
                 'AnnotationTypeConfig', 'CursGenotypeList', 'CursSessionDetails', 'CantoConfig',
                 annotationTableCtrl]);


var annotationTableList =
  function(AnnotationProxy, AnnotationTypeConfig, CantoGlobals) {
    return {
      scope: {
        featureIdFilter: '@',
        featureTypeFilter: '@',
        featureFilterDisplayName: '@',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/annotation_table_list.html',
      controller: function($scope) {
        $scope.countKeys = countKeys;
        $scope.app_static_path = CantoGlobals.app_static_path;
        $scope.annotationTypes = [];
        $scope.annotationsByType = {};
        $scope.serverErrorsByType = {};
        $scope.byTypeSplit = {};

        $scope.capitalizeFirstLetter = capitalizeFirstLetter;
        $scope.data = {};

        $scope.watchAndFilter =
          function(annotations, annotationType) {
            function doFilter(annotations, featureStatusFilter, alleleCountFilter) {
              var params = {
                featureId: $scope.featureIdFilter,
                featureType: $scope.featureTypeFilter,
                featureStatus: featureStatusFilter,
                alleleCount: alleleCountFilter,
              };
              var key = featureStatusFilter;
              var filteredAnnotations = filterAnnotations(annotations, params);
              if (filteredAnnotations.length > 0) {
                if (typeof(alleleCountFilter) != 'undefined') {
                  if (typeof($scope.byTypeSplit[annotationType.name][key]) == 'undefined') {
                    $scope.byTypeSplit[annotationType.name][key] = {};
                  }
                  $scope.byTypeSplit[annotationType.name][key][alleleCountFilter] =
                    filteredAnnotations;
                } else {
                  $scope.byTypeSplit[annotationType.name][key] =
                    filteredAnnotations;
                }
              }
            }

            $scope.$watch('annotationsByType.' + annotationType.name,
                          function(annotations) {

                            $scope.byTypeSplit[annotationType.name] = {};

                            if (annotationType.feature_type == 'genotype') {
                              doFilter(annotations, 'new', 'single');
                              doFilter(annotations, 'new', 'multi');
                              doFilter(annotations, 'existing', 'single');
                              doFilter(annotations, 'existing', 'multi');
                            } else {
                              doFilter(annotations, 'new');
                              doFilter(annotations, 'existing');
                            }
                          },
                          true);
          };

        AnnotationTypeConfig.getAll().then(function(response) {
          $scope.annotationTypes =
            $.grep(response.data,
                   function(annotationType) {
                     if ($scope.featureTypeFilter === undefined ||
                         $scope.featureTypeFilter === 'gene' ||
                         annotationType.feature_type === $scope.featureTypeFilter) {
                       return annotationType;
                     }
                   });

          $.map($scope.annotationTypes,
                function(annotationType) {
                  AnnotationProxy.getAnnotation(annotationType.name)
                    .then(function(annotations) {
                      $scope.annotationsByType[annotationType.name] = annotations;
                      $scope.watchAndFilter(annotations, annotationType);
                    }).catch(function() {
                      $scope.serverErrorsByType[annotationType.name] =
                        "couldn't read annotations from the server - please try reloading";
                    });
                });
        }).catch(function(data, status) {
          if (status) {
            $scope.data.serverError = "couldn't read annotation types from the server ";
          } // otherwise the request was cancelled
        });
      },
    };
  };

canto.directive('annotationTableList', ['AnnotationProxy', 'AnnotationTypeConfig', 'CantoGlobals', annotationTableList]);


var annotationTableRow =
  function($uibModal, CursSessionDetails, CursAnnotationDataService, AnnotationProxy, AnnotationTypeConfig, CantoGlobals, CantoConfig, toaster) {
    return {
      restrict: 'A',
      replace: true,
      templateUrl: function(elem,attrs) {
        return app_static_path + 'ng_templates/annotation_table_' +
          attrs.annotationTypeName + '_row.html';
      },
      controller: function($scope, $element, $attrs) {
        $scope.curs_root_uri = CantoGlobals.curs_root_uri;
        $scope.read_only_curs = CantoGlobals.read_only_curs;
        $scope.multiOrganismMode = false;
        $scope.sessionState = 'UNKNOWN';

        CursSessionDetails.get()
          .success(function(sessionDetails) {
            $scope.sessionState = sessionDetails.state;
          });

        var annotation = $scope.annotation;

        $scope.checked = annotation['checked'] || 'no';

        $scope.setChecked = function($event) {
          CursAnnotationDataService.set(annotation.annotation_id,
                                        'checked', 'yes')
            .success(function() {
              $scope.checked = 'yes';
            });
          $event.preventDefault();
        };

        $scope.clearChecked = function($event) {
          CursAnnotationDataService.set(annotation.annotation_id,
                                        'checked', 'no')
            .success(function() {
              $scope.checked = 'no';
            });
          $event.preventDefault();
        }

        $scope.displayEvidence = annotation.evidence_code;

        if (typeof($scope.annotation.conditions) !== 'undefined') {
          $scope.annotation.conditionsString =
            conditionsToStringHighlightNew($scope.annotation.conditions);
        }

        var qualifiersList = [];

        if (typeof($scope.annotation.qualifiers) !== 'undefined' && $scope.annotation.qualifiers !== null) {
          qualifiersList = $scope.annotation.qualifiers;
        }

        if ($scope.annotation.is_not) {
          qualifiersList.unshift('NOT');
        }

        $scope.annotation.qualifiersString = qualifiersList.join(', ');

        var annotationTypePromise =
            AnnotationTypeConfig.getByName(annotation.annotation_type);
        annotationTypePromise
          .then(function(annotationType) {
            $scope.annotationType = annotationType;
          });

        CantoConfig.get('instance_organism').success(function(results) {
          if (!results.taxonid) {
            $scope.multiOrganismMode = true;
          }
        });

        $scope.$watch('annotation.evidence_code',
                      function(newEvidenceCode) {
                        if (newEvidenceCode) {
                          CantoConfig.get('evidence_types').success(function(results) {
                            $scope.evidenceTypes = results;

                            annotationTypePromise.then(function() {
                              if (results[newEvidenceCode]) {
                                $scope.displayEvidence = results[newEvidenceCode].name;
                              } else {
                                $scope.displayEvidence = newEvidenceCode;
                              }
                            });
                          });
                        } else {
                          $scope.displayEvidence = '';
                        }
                      });

        $scope.addLinks = function() {
          return !CantoGlobals.read_only_curs &&
            $attrs.featureStatusFilter == 'new';
        };

        $scope.featureLink = function(featureType, featureId) {
          return $scope.curs_root_uri + '/feature/' +
            featureType + '/view/' +
            featureId + ($scope.read_only_curs ? '/ro' : '');
        };

        $scope.edit = function() {
          // FIXME: featureFilterDisplayName is from the parent scope
          var editPromise =
            startEditing($uibModal, annotation.annotation_type, $scope.annotation,
                         $scope.featureFilterDisplayName, false, true);

          editPromise.then(function(editedAnnotation) {
            $scope.annotation = editedAnnotation;
            if (typeof($scope.annotation.conditions) !== 'undefined') {
              $scope.annotation.conditionsString =
                conditionsToString($scope.annotation.conditions);
            }
          });
        };

        $scope.duplicate = function() {
          var newAnnotation = makeNewAnnotation($scope.annotation);
          startEditing($uibModal, annotation.annotation_type,
                       newAnnotation, $scope.featureFilterDisplayName,
                       true, true);
        };

        $scope.deleteAnnotation = function() {
          loadingStart();
          AnnotationProxy.deleteAnnotation(annotation)
            .then(function() {
              toaster.pop('success', 'Annotation deleted');
            })
            .catch(function(message) {
              toaster.pop('note', "Couldn't delete the annotation: " + message);
            })
            .finally(function() {
              loadingEnd();
            });
        };
      },
    };
  };

canto.directive('annotationTableRow',
                ['$uibModal', 'CursSessionDetails', 'CursAnnotationDataService',
                 'AnnotationProxy', 'AnnotationTypeConfig',
                 'CantoGlobals', 'CantoConfig', 'toaster',
                 annotationTableRow]);


var annotationSingleRow =
  function(AnnotationTypeConfig, CantoConfig, CantoService, Curs) {
    return {
      restrict: 'E',
      scope: {
        featureType: '@',
        featureDisplayName: '@',
        annotationTypeName: '@',
        annotationDetails: '=',
      },
      replace: true,
      templateUrl: function() {
        return app_static_path + 'ng_templates/annotation_single_row.html';
      },
      controller: function($scope) {
        $scope.displayFeatureType = capitalizeFirstLetter($scope.featureType);

        $scope.displayEvidence = '';
        $scope.conditionsString = '';
        $scope.withGeneDisplayName = '';

        AnnotationTypeConfig.getByName($scope.annotationTypeName)
          .then(function(annotationType) {
            $scope.annotationType = annotationType;
          });

        $scope.$watch('annotationDetails.term_ontid',
                      function(newId) {
                        if (newId) {
                          CantoService.lookup('ontology', [newId],
                                              {
                                                def: 1,
                                                children: 1,
                                                exact_synonyms: 1,
                                                subset_ids: 1,
                                              })
                            .then(function(response) {
                              $scope.termDetails = response.data;
                            });
                        } else {
                          $scope.termDetails = {};
                        }
                      });

        $scope.$watch('annotationDetails.conditions',
                      function(newConditions) {
                        if (newConditions) {
                          $scope.conditionsString =
                            conditionsToString(newConditions);
                        }
                      },
                      true);

        $scope.$watch('annotationDetails.evidence_code',
                      function(newCode) {
                        $scope.displayEvidence = newCode;

                        if (newCode) {
                          CantoConfig.get('evidence_types').success(function(results) {
                            $scope.evidenceTypes = results;
                            $scope.displayEvidence = results[newCode].name;
                          });
                        }
                      });

        $scope.$watch('annotationDetails.with_gene_id',
                      function(newWithId) {
                        if (newWithId) {
                          Curs.list('gene').success(function(results) {
                            $scope.genes = results;

                            $.map($scope.genes,
                                  function(gene) {
                                    if (gene.gene_id == newWithId) {
                                      $scope.withGeneDisplayName =
                                        gene.primary_name || gene.primary_identifier;
                                    }
                                  });
                          });
                        } else {
                          $scope.withGeneDisplayName = '';
                        }
                      });
      },
    };
  };

canto.directive('annotationSingleRow',
                ['AnnotationTypeConfig', 'CantoConfig', 'CantoService', 'Curs',
                 annotationSingleRow]);


var termNameComplete =
  function(CantoGlobals, CantoConfig, AnnotationTypeConfig, CantoService, $q, $timeout) {
    return {
      scope: {
        annotationTypeName: '@',
        currentTermName: '@',
        foundCallback: '&',
        mode: '@',
        size: '@',
      },
      controller: function($scope) {
        $scope.app_static_path = CantoGlobals.app_static_path;
        $scope.termCount = null;
        $scope.allTerms = [];

        $scope.extensionLookup = ($scope.mode && $scope.mode == 'extension' ? 1 : 0);

        CantoConfig.get('max_term_name_select_count').success(function(results) {
          var maxCount = results.value;
          CantoService.lookup('ontology', [$scope.annotationTypeName,
                                           ':COUNT:'], {
                                             extension_lookup: $scope.extensionLookup
                                           })
            .then(function(result) {
              if (result.status == 200) {
                $scope.termCount = result.data.count;
                if ($scope.termCount <= maxCount) {
                  CantoService.lookup('ontology',
                                      [$scope.annotationTypeName, ':ALL:'], {
                                        extension_lookup: $scope.extensionLookup
                                      })
                    .then(function(results) {
                      // this triggers using a dropdown instead of autocomplete
                      $scope.allTerms = results.data;
                    });
                }
              }
            });
        });

        $scope.placeholder = '';

        var re = new RegExp(/\[([^\[\]]+)\]/);
        $scope.typeMatch = re.exec($scope.annotationTypeName);

        if ($scope.typeMatch) {
          var split = $scope.typeMatch[1].split(/\s*\|\s*/);
          var promises =
            $.map(split,
                  function(termId) {
                    return CantoService.lookup('ontology', [termId], {});
                  });
          $q.all(promises).then(function(results) {
            $scope.placeholder =
              $.map(results, function(result) {
                return result.data.name;
              }).join(" or ") + " ...";
          });
        }

        $scope.render_term_item =
          function(ul, item, search_string) {
            var searchAnnotationTypeName = $scope.annotationTypeName;
            var search_bits = search_string.split(/\W+/);
            var match_name = item.matching_synonym;
            var synonym_extra = '';
            if (match_name) {
              synonym_extra = ' (synonym)';
            } else {
              match_name = item.name;
            }
            var warning = '';
            if (searchAnnotationTypeName.indexOf('[') != 0 &&
                searchAnnotationTypeName !== item.annotation_type_name) {
              warning = '<br/><span class="autocomplete-warning">WARNING: this is the ID of a ' +
                item.annotation_type_name + ' term but<br/>you are browsing ' +
                searchAnnotationTypeName + ' terms</span>';
              var re = new RegExp('_', 'g');
              // unpleasant hack to make the namespaces look nicer
              warning = warning.replace(re,' ');
            }
            function length_compare(a,b) {
              if (a.length < b.length) {
                return 1;
              }
              if (a.length > b.length) {
                return -1;
              }
              return 0;
            }
            search_bits.sort(length_compare);
            for (var i = 0; i < search_bits.length; i++) {
              var bit = search_bits[i];
              if (bit.length > 1) {
                var boldRE = new RegExp('(\\b' + bit + ')', "gi");
                match_name = match_name.replace(boldRE,'<b>$1</b>');
              }
            }
            return $( "<li></li>" )
              .data( "item.autocomplete", item )
              .append( "<a>" + match_name + " <span class='term-id'>(" +
                       item.id + ")</span>" + synonym_extra + warning + "</a>" )
              .appendTo( ul );
          };
      },
      replace: true,
      restrict: 'E',
      templateUrl: app_static_path + 'ng_templates/term_name_complete.html',
      link: function(scope, elem) {
        if (!scope.size) {
          scope.size = 40;
        }

        var valBeforeComplete = null;
        var input = $(elem).find('input');
        input.autocomplete({
          minLength: 2,
          source: make_ontology_complete_url(scope.annotationTypeName, scope.extensionLookup),
          cacheLength: 100,
          focus: ferret_choose.show_autocomplete_def,
          open: function() {
            valBeforeComplete = input.val();
          },
          close: ferret_choose.hide_autocomplete_def,
          select: function(event, ui) {
            var trimmedValBeforeComplete = null;
            if (valBeforeComplete) {
              trimmedValBeforeComplete = trim(valBeforeComplete);
            }
            $timeout(function() {
              scope.foundCallback({ termId: ui.item.id,
                                    termName: ui.item.value,
                                    searchString: trimmedValBeforeComplete,
                                    matchingSynonym: ui.item.matching_synonym,
                                  });
            }, 1);
            valBeforeComplete = null;
            ferret_choose.hide_autocomplete_def();
          },
        }).data("autocomplete")._renderItem = function( ul, item ) {
          var search_string = input.val();
          return scope.render_term_item(ul, item, search_string);
        };
        input.attr('disabled', false);

        function do_autocomplete (){
          input.focus();
          scope.$apply(function() {
            input.autocomplete('search');
          });
        }

        input.bind('paste', function() {
          setTimeout(do_autocomplete, 10);
        });

        input.bind('click', function() {
          setTimeout(do_autocomplete, 10);
        });

        input.keypress(function(event) {
          if (event.which == 13) {
            // return should autocomplete not submit the form
            event.preventDefault();
            do_autocomplete();
          }
        });

        var select = $(elem).find('select');

        select.change(function() {
          $timeout(function() {
            var termId = null;
            var termName = null;
            if (scope.chosenTerm) {
              termId = scope.chosenTerm.id;
              termName = scope.chosenTerm.name;
            }
            scope.foundCallback({
              termId: termId,
              termName: termName,
              searchString: null,
              matchingSynonym: null,
            });
          }, 1);
        });
      }
    };
  };

canto.directive('termNameComplete',
                ['CantoGlobals', 'CantoConfig', 'AnnotationTypeConfig',
                 'CantoService', '$q', '$timeout',
                 termNameComplete]);


var termChildrenQuery =
  function($uibModal, CantoService) {
    return {
      scope: {
        termId: '=',
        termName: '=',
      },
      controller: function($scope) {
        $scope.data = { children: [] };

        $scope.confirmTerm = function() {
          var termConfirm = openTermConfirmDialog($uibModal, $scope.termId, 'children');

          termConfirm.result.then(function(result) {
            $scope.termId = result.newTermId;
            $scope.termName = result.newTermName;
          });
        };
      },
      replace: true,
      restrict: 'E',
      templateUrl: app_static_path + 'ng_templates/term_children_query.html',
      link: function($scope) {
        $scope.$watch('termId',
                      function(newTermId) {
                        if (newTermId) {
                          var promise = CantoService.lookup('ontology', [$scope.termId],
                                                            {
                                                              def: 1,
                                                              children: 1,
                                                              exact_synonyms: 1,
                                                            });

                          promise.success(function(data) {
                            if (!data.children || data.children.length == 0) {
                              $scope.data.children = [];
                            } else {
                              $scope.data.children = data.children;
                            }
                          });
                        } else {
                          $scope.data.children = [];
                        }
                      });
      }
    };
  };

canto.directive('termChildrenQuery', ['$uibModal', 'CantoService', termChildrenQuery]);


var initiallyHiddenText =
  function() {
    return {
      scope: {
        text: '@',
        linkLabel: '@',
        previewCharCount: '@',
      },
      restrict: 'E',
      replace: true,
      link: function($scope, elem) {
        $scope.previewChars = '';
        $scope.hidden = true;

        $scope.trimmedText = $.trim($scope.text);

        $scope.show = function() {
          $scope.hidden = false;
        };

        $scope.$watch('text',
                      function() {
                        $scope.trimmedText = $.trim($scope.text);

                        if ($scope.previewCharCount && $scope.previewCharCount > 0) {
                          if ($scope.previewCharCount < $scope.trimmedText.length) {
                            $scope.previewChars = $scope.text.substr(0, $scope.previewCharCount);
                          } else {
                            $scope.hidden = false;
                          }
                        }
                      });
      },
      template: '<span ng-show="trimmedText.length > 0">' +
        '<span ng-hide="hidden">{{trimmedText}}</span>' +
        '<span ng-show="hidden" uib-tooltip="{{trimmedText}}">' +
        '  <span ng-show="previewChars.length > 0">{{previewChars}}</span>' +
        '  <a ng-click="show()">&nbsp;<span style="font-weight: bold">{{linkLabel}}</span></a>' +
        '</span></span>',
    };
  };

canto.directive('initiallyHiddenText', [initiallyHiddenText]);


var activeSessionStatuses =
    ['SESSION_CREATED', 'SESSION_ACCEPTED', 'CURATION_IN_PROGRESS', 'CURATION_PAUSED']

var userPubsLookupCtrl =
  function(CantoGlobals, CantoService) {
    return {
      scope: {
        initialEmailAddress: '@',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/user_pubs_lookup.html',
      controller: function($scope) {
        var maxPubs = 10;

        $scope.emailAddress = $scope.initialEmailAddress;

        $scope.app_static_path = CantoGlobals.app_static_path;
        $scope.is_admin_user = CantoGlobals.is_admin_user;
        $scope.application_root = CantoGlobals.application_root;

        $scope.searching = false;
        $scope.truncatedList = true;

        $scope.updateLists = function() {
          $scope.activeList = [];
          $scope.completedList = [];

          for (var i = 0; i < $scope.pubResults.length; i++) {
            var pub = $scope.pubResults[i]
            if ($.inArray(pub.status, activeSessionStatuses) >= 0) {
              if (!$scope.truncatedList || $scope.activeList.length < maxPubs) {
                $scope.activeList.push(pub);
              }
            } else {
              if (!$scope.truncatedList || $scope.completedList.length < maxPubs) {
                $scope.completedList.push(pub);
              }
            }

            if ($scope.truncatedList) {
              if ($scope.activeList.length == maxPubs &&
                  $scope.completedList.length == maxPubs) {
                break;
              }
            }
          }
        };

        $scope.showAll = function() {
          $scope.truncatedList = false;
          $scope.updateLists();
        };

        $scope.search = function() {
          $scope.pubResults = null;
          if ($scope.emailAddress) {
            $scope.searching = true;
            var pathParts = ['by_curator_email', $scope.emailAddress];
            var promise =
                CantoService.lookup('pubs', pathParts, {});

            promise.success(function(data) {
              if (data.status == 'success') {
                $scope.pubResults = data.pub_results;
                $scope.updateLists();
                $scope.truncatedList =
                  $scope.activeList.length + $scope.completedList.length < $scope.pubResults.length;
              }
            });

            promise.finally(function() {
              $scope.searching = false;
            });
          }
        };

        $scope.reset = function() {
          $scope.pubResults = null;
          $scope.activeList = null;
          $scope.completedList = null;
          $scope.count = -1;
        };

        $scope.reset();
      },
    };
  };

canto.directive('userPubsLookup',
                ['CantoGlobals', 'CantoService', userPubsLookupCtrl]);


var pubsListViewCtrl =
  function(CantoGlobals) {
    return {
      scope: {
        rows: '=',
      },
      restrict: 'E',
      replace: true,
      templateUrl: app_static_path + 'ng_templates/pubs_list_view.html',
      controller: function($scope) {
        $scope.CantoGlobals = CantoGlobals;
        $scope.application_root = CantoGlobals.application_root;
      },
    };
  };

canto.directive('pubsListView', ['CantoGlobals', pubsListViewCtrl]);


var AnnotationStatsCtrl =
  function($scope, CantoGlobals) {
    $scope.visibleMap = {};
    $scope.curationStatusLabels = CantoGlobals.curationStatusData[0];
    $scope.curationStatusData = CantoGlobals.curationStatusData.slice(1);
    $scope.cumulativeAnnotationTypeCountsLabels = CantoGlobals.cumulativeAnnotationTypeCounts[0];
    $scope.cumulativeAnnotationTypeCountsData = CantoGlobals.cumulativeAnnotationTypeCounts.slice(1);
    var currentYear = (new Date()).getFullYear();
    $scope.perPub5YearStatsLabels =
      $.map(CantoGlobals.perPub5YearStatsData[0],
            function(year) {
              if (year == currentYear) {
                return year;
              } else {
                var rangeEnd = (year + 4);
                if (rangeEnd > currentYear) {
                  rangeEnd = currentYear;
                }
                return year + "-" + rangeEnd;
              }
            });
    $scope.perPub5YearStatsData = CantoGlobals.perPub5YearStatsData.slice(1);

    $scope.show = function($event, key) {
      $scope.visibleMap[key] = true;
      $event.preventDefault();
    };

    $scope.isVisible = function(key) {
      return $scope.visibleMap[key] || false;
    };
  };

canto.controller('AnnotationStatsCtrl',
                 ['$scope', 'CantoGlobals', AnnotationStatsCtrl]);


var stackedGraph =
    function() {
      return {
        scope: {
          chartLabels: '=',
          chartData: '=',
          chartSeries: '@',
        },
        restrict: 'E',
        replace: true,
        template: '<div><canvas class="chart chart-bar" chart-data="chartData" ' +
          'chart-labels="chartLabels" chart-options="options" ' +
          'chart-colors="colours" ' +
          'chart-series="series"></canvas></div>',
        controller: function ($scope) {
          $scope.type = 'StackedBar';
          $scope.series = $scope.chartSeries.split('|');
          $scope.options = {
            legend: { display: true },
            scales: {
              xAxes: [{
                stacked: true,
              }],
              yAxes: [{
                stacked: true,
              }]
            }
          };
      }
    }
  };

canto.directive('stackedGraph', [stackedGraph]);


var barChart =
  function() {
    return {
      scope: {
        chartLabels: '=',
        chartData: '=',
      },
      restrict: 'E',
      replace: true,
      template: '<div><canvas class="chart chart-bar" chart-data="[chartData]" ' +
        'chart-labels="chartLabels" chart-options="options"></canvas></div>',
      controller: function ($scope) {
        $scope.type = 'Bar';
        $scope.options = {
          legend: { display: false },
        };
    }
  }
};

canto.directive('barChart', [barChart]);
