cmake_minimum_required(VERSION 3.14)
project(endendend_msgs)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED)
find_package(builtin_interfaces REQUIRED)
find_package(geometry_msgs REQUIRED)

set(msg_files
  msg/DroneState.msg
  msg/Heartbeat.msg
  msg/SwarmGlobalState.msg
  msg/VictimDetection.msg
)

set(srv_files
  srv/KillDrone.srv
  srv/VertexElection.srv
  srv/InjectFailure.srv
)

rosidl_generate_interfaces(${PROJECT_NAME}
  ${msg_files}
  ${srv_files}
  DEPENDENCIES builtin_interfaces geometry_msgs
)

ament_package()
