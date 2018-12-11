(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: [
                              'http://loinc.org|8302-2', // height
                              'http://loinc.org|8462-4', // diastolic
                              'http://loinc.org|8480-6', // systolic
                              'http://loinc.org|2085-9', // hdl cholesterol
                              'http://loinc.org|2089-1', // ldl cholesterol
                              'http://loinc.org|55284-4' // blood pressure dia/sys
                              ]
                      }
                    }
                  });

        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');

          // DATA
          ehr_patient_id = patient.id;
          patient_email = 'No Email';
          first_name = '';
          last_name = '';
          gender = patient.gender;
          dob = patient.birthDate;
          zipcode = patient.address[0].postalCode;

          if (typeof patient.name[0] !== 'undefined') {
            first_name = patient.name[0].given.join(' ');
            last_name = patient.name[0].family.join(' ');

            var telecomLength = patient.telecom.length;

            for (var i = 0; i < telecomLength; i++){

              if (patient.telecom[i].system == "email"){
                patient_email = patient.telecom[i].value;
              }
            }
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();

          p.ehr_patient_id = ehr_patient_id;
          p.patient_email = patient_email;
          p.first_name = first_name;
          p.last_name = last_name;
          p.gender = gender;
          p.dob = dob;
          p.zipcode = zipcode;


          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      ehr_patient_id: {value:''},
      patient_email: {value:''},
      first_name: {value: ''},
      last_name: {value: ''},
      gender: {value: ''},
      dob: {value: ''},
      zipcode: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      /*
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      */

      var BP = [];
      var component = observation.component;

      for (i = 0; i < component.length; i++) {
        var coding = component[i].code.coding;

        for (i = 0; i < coding.length; i++) {
          if (coding[i].code == typeOfPressure) {
            BP.push(coding[i].code);
          }
        }
      }

      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }


  window.init = function(patient) {
    console.log(patient);
    var __baseApi = 'https://apihipaa.atpoc.com/api-ehr/1.0/';
    var __viewType = $('body').attr('data-cerner-view');
    var __loader = $('#loading');
    var __container = $('#holder');
    var __profile = $('#cernerProfile');

    // Hardcode
    var data = patient;
    data.ehr_clinician_id = 'cerner_clinician_123456';
    data.clinician_email = 'cerner1@cmeaday.com';

    // Store data
    sessionStorage.cerner_data = JSON.stringify(data);

    var dob = patient.dob.split('-');
    dob = dob[1] + '/' + dob[2] + '/' + dob[0];

    // @POC Data
    $.post(__baseApi + 'patient_landing', {
      "ehr_patient_id": patient.ehr_patient_id,
      "ehr_clinician_id": data.ehr_clinician_id,
      "ehr_system_id": 1
    }).done(function (data) {
      console.log(data);
      // Check patient status
      if (data.patient_status == 0 || data.patient_status == 1) {
        $('#accordionMonitor').addClass('disabled');
      };

      // Append user profile to headler
      __profile.append('<li class="cerner-profile_list-item cerner-profile_list-name">\n\t\t\t\t\t\t<label id="profileName">' + patient.last_name + ', ' + patient.first_name + '</label>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li class="cerner-profile_list-item cerner-profile_list-dob">\n\t\t\t\t\t\t<label>DOB: </label>\n\t\t\t\t\t\t<span id="profileDob">' + dob + '</span>\n\t\t\t\t\t</li>\n\t\t\t\t\t<li class="cerner-profile_list-item cerner-profile_list-sex">\n\t\t\t\t\t\t<label>SEX: </label>\n\t\t\t\t\t\t<span id="profileSex">' + patient.gender + '</span>\n\t\t\t\t\t</li>');

      // Check view type to add content
      switch (__viewType) {
        case 'order':
          loadAppList({
            apps: data.list_applications,
            wrap: $('#cernerAppList')
          });
          break;
        case 'monitor':
          loadCharts({
            id: patient.ehr_patient_id,
            apps: data.patient_apps,
            wrap: $('#cernerCharts')
          });
          break;
      }
    }).fail(function (e) {
      return console.log(e);
    });
    ////////////////////////////////////////
    ////////// APP LIST ///////////////////
    function loadAppList(props) {
      var apps = props.apps,
          wrap = props.wrap;

      // create catalog

      var html = apps.map(function (app, i) {
        var app_id = app.app_id,
            description = app.description,
            display_name = app.display_name,
            download_url = app.download_url,
            icon_url = app.icon_url,
            status = app.status,
            app_status_text = app.app_status_text;


      return '<li id="app-' + app_id + '" class="cerner-catalog_list-item">\n\t\t\t\t\t\t<div class="cerner-catalog_item-icon">\n\t\t\t\t\t\t\t<img src="' + icon_url + '" width="100%" height="100%">\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class="cerner-catalog_item-content">\n\t\t\t\t\t\t\t<article>\n\t\t\t\t\t\t\t\t<h4>' + display_name + '</h4>\n\t\t\t\t\t\t\t\t<p>' + description + '</p>\n\t\t\t\t\t\t\t</article>\n\t\t\t\t\t\t\t<button class="cerner-catalog_prescribe' + (status == 1 ? ' paired' : status == 2 ? ' pending' : '') + '" data-app-id="' + app_id + '" data-dlink="' + download_url + '">' + app_status_text + (status == 1 ? '' //'<span class="fas fa-check-circle"></span>' 
        : '') + '</button>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</li>';
      }).join('\n');

      wrap.append(html);
      __container.show();
      __loader.hide();

      prescribePatient();
    }
    ////////////////////////////////////////
    ////////// PRESCRIBE //////////////////
    function prescribePatient() {
      var triggers = document.querySelectorAll('.cerner-catalog_prescribe');

      for (i = 0; i < triggers.length; i++) {
        triggers[i].onclick = function (e) {
          e.preventDefault();

          var app_id = e.target.getAttribute('data-app-id');
          var dlink = e.target.getAttribute('data-dlink');
          var data = JSON.parse(sessionStorage.cerner_data);

          $.post(__baseApi + 'prescribe_app', {
            "ehr_system_id": 1,
            "ehr_patient_id": data.ehr_patient_id,
            "patient_email": data.patient_email,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "gender": data.gender,
            "dob": data.dob,
            "zipcode": data.zipcode,
            "ehr_clinician_id": data.ehr_clinician_id,
            "clinician_email": data.clinician_email,
            "app_id": e.target.getAttribute('data-app-id')
          }).done(function (data) {
            location.reload();
          }).fail(function (e) {
            return console.log(e);
          });
        };
      }
    }
    ////////////////////////////////////////
    ////////// CHARTS /////////////////////
    function loadCharts(props) {
      var id = props.id,
          apps = props.apps,
          wrap = props.wrap;

      // load patient id
      $.get('https://api.atpoc.com/api-suite/7.0/patient_num_cerner?cerner_num=' + id)
        .done(function(data) {
          console.log(data);
          // chart object
          var html = '<object data="https://api.atpoc.com/html/mycharts2/2.0/index.php?patID=' + data + '&amp;chart=dayRating&amp;range=365&amp;appID=' + apps + '&amp;suite=3" type="text/html"></object>';

          wrap.append(html);
          __container.show();
          __loader.hide();
        })
        .fail(function(e) {
          console.log(e)
        });
    }
  };

})(window);
