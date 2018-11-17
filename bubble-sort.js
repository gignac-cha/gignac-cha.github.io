angular
.module("app")
.controller("bubble-sort", ($scope, $q, $timeout, $interval) => {
  $scope.list = [];
  $scope.generate = (n, m) => $scope.list = _.map(_.range(n), i => ({ value: _.random(m)}));
  $scope.sort = list => {
    // $timeout(() => $scope.comparing = true)
    // .then(() => $timeout(() => {
    //   $scope.left = $scope.list[0];
    //   $scope.right = $scope.list[1];
    // }, 1000));
    // $timeout(() => console.log(1), 1000)
    // .then(() => $timeout(() => console.log(2), 1000))
    // .then(() => $timeout(() => console.log(3), 1000))

    // $timeout(() => $scope.comparing = true)
    // .then(() => $timeout(function (i) {
    //   console.log("$timeout", i)
    //   $scope.swapped = false;
    //   $scope.left = $scope.list[i];
    //   $scope.right = $scope.list[i + 1];
    //   if ($scope.left.value > $scope.right.value) {
    //     $scope.comparison = '>';
    //     $scope.swapped = true;
    //   }
    //   else {
    //     $scope.comparison = "<=";
    //   }
    //   if (i + 2 < $scope.list.length) {
    //     $timeout(arguments.callee, 1000, true, i + 1);
    //   }
    //   else {
    //     $scope.comparing = false;
    //   }
    // }, 0, true, 0))
    // .then(() => console.log("after timeout"));

    $scope.comparing = true;
    $timeout(function(i, j) {
      if (i % 60 === 0) {
        $scope.left = $scope.list[j];
        $scope.right = $scope.list[j + 1];
        if ($scope.left.value > $scope.right.value) {
          $scope.comparison = '>';
          $scope.swapped = true;
        }
        else {
          $scope.comparison = "<=";
        }
      }
      if (i % 60 === 50) {
        $scope.left = null;
        $scope.right = null;
        $scope.swapped = false;
        j++;
      }
      if (j + 2 < $scope.list.length) {
        $timeout(arguments.callee, 1000 / 60, true, i + 1, j);
      }
      else {
        $scope.comparing = false;
      }
    }, 0, true, 0, 0);
  };

  !(() => {
    $scope.length = 10;
    $scope.maximum = 100;
  })();
});