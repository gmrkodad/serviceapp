from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from accounts.permissions import IsAdmin
from accounts.permissions import IsCustomer
from .serializers import BookingCreateSerializer, ReviewCreateSerializer, ReviewListSerializer
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsCustomer
from .serializers import BookingListSerializer
from .models import Booking
from accounts.permissions import IsAdmin
from accounts.models import User
from accounts.permissions import IsProvider
from accounts.models import ProviderProfile, Notification

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsCustomer
from accounts.models import ProviderProfile
from accounts.models import Notification
from .serializers import BookingCreateSerializer


class CreateBookingAPIView(APIView):
    permission_classes = [IsAuthenticated, IsCustomer]

    def post(self, request):
        serializer = BookingCreateSerializer(
            data=request.data,
            context={"request": request}
        )

        if serializer.is_valid():
            provider = serializer.validated_data.get("provider")

            # 🔐 SECURITY CHECK
            if provider:
                if provider.role != "PROVIDER":
                    return Response(
                        {"error": "Invalid provider"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            booking = serializer.save(
                customer=request.user
            )

            if provider:
                Notification.objects.create(
                    user=provider,
                    message=f"New booking request"
                )

            return Response(
                {
                    "message": "Booking created successfully",
                    "booking_id": booking.id
                },
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomerBookingsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsCustomer]

    def get(self, request):
        bookings = Booking.objects.filter(
            customer=request.user
        ).order_by("-created_at")

        serializer = BookingListSerializer(bookings, many=True)
        return Response(serializer.data)

    



class AdminBookingsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        bookings = Booking.objects.all().order_by("-created_at")
        serializer = BookingListSerializer(bookings, many=True)
        return Response(serializer.data)
    



class AssignProviderAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        provider_id = request.data.get("provider_id")

        try:
            provider = User.objects.get(
                id=provider_id,
                role="PROVIDER"
            )
        except User.DoesNotExist:
            return Response({"error": "Invalid provider"}, status=400)

        booking.provider = provider
        booking.status = Booking.Status.ASSIGNED
        booking.save()

        return Response(
            {"message": "Provider assigned successfully"},
            status=status.HTTP_200_OK
        )

from accounts.permissions import IsProvider


from accounts.models import Notification

class ProviderActionAPIView(APIView):
    permission_classes = [IsAuthenticated, IsProvider]

    def post(self, request, booking_id):
        action = request.data.get("action")

        try:
            booking = Booking.objects.get(
                id=booking_id,
                provider=request.user
            )
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        if action == "accept":
            booking.status = Booking.Status.CONFIRMED
            message = "Your booking has been accepted 🎉"

        elif action == "reject":
            booking.status = Booking.Status.PENDING
            booking.provider = None
            message = "Your booking was rejected ❌"

        else:
            return Response({"error": "Invalid action"}, status=400)

        booking.save()

        # 🔔 NOTIFY CUSTOMER
        Notification.objects.create(
            user=booking.customer,
            message=message
        )

        return Response({"message": f"Booking {action}ed successfully"})



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsProvider
from .models import Booking
from .serializers import ProviderBookingSerializer


class ProviderDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated, IsProvider]

    def get(self, request):
        bookings = Booking.objects.filter(
            provider=request.user
        ).order_by("-created_at")

        serializer = ProviderBookingSerializer(bookings, many=True)
        return Response(serializer.data)





class UpdateBookingStatusAPIView(APIView):
    permission_classes = [IsAuthenticated, IsProvider]

    def post(self, request, booking_id):
        new_status = request.data.get("status")

        try:
            booking = Booking.objects.get(
                id=booking_id,
                provider=request.user
            )
        except Booking.DoesNotExist:
            return Response(
                {"error": "Booking not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Allowed transitions
        allowed_transitions = {
            Booking.Status.CONFIRMED: Booking.Status.IN_PROGRESS,
            Booking.Status.IN_PROGRESS: Booking.Status.COMPLETED,
        }

        current_status = booking.status

        if current_status not in allowed_transitions:
            return Response(
                {"error": f"Cannot update status from {current_status}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status != allowed_transitions[current_status]:
            return Response(
                {
                    "error": f"Invalid transition. Allowed: {allowed_transitions[current_status]}"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = new_status
        booking.save()

        return Response(
            {
                "message": "Booking status updated",
                "booking_id": booking.id,
                "new_status": booking.status
            },
            status=status.HTTP_200_OK
        )


from .models import Review
from accounts.permissions import IsCustomer


class CreateReviewAPIView(APIView):
    permission_classes = [IsAuthenticated, IsCustomer]

    def post(self, request, booking_id):
        try:
            booking = Booking.objects.get(
                id=booking_id,
                customer=request.user,
                status=Booking.Status.COMPLETED
            )
        except Booking.DoesNotExist:
            return Response(
                {"error": "Booking not completed or not found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if hasattr(booking, "review"):
            return Response(
                {"error": "Review already submitted"},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ReviewCreateSerializer(data=request.data)
        if serializer.is_valid():
            Review.objects.create(
                booking=booking,
                author=request.user,
                rating=serializer.validated_data["rating"],
                comment=serializer.validated_data.get("comment", "")
            )
            return Response(
                {"message": "Review submitted successfully"},
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminReviewListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        reviews = Review.objects.select_related("booking", "author", "booking__provider", "booking__service").order_by("-created_at")
        serializer = ReviewListSerializer(reviews, many=True)
        return Response(serializer.data)
